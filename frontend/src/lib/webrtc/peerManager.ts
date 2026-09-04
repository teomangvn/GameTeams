import type { SignalMessage } from "@/api/voice";

/**
 * WebRTC mesh yoneticisi: kanaldaki her katilimci icin ayri bir
 * RTCPeerConnection tutar.
 *
 * Teklif kuralı deterministiktir — id'si kucuk olan taraf teklifi baslatir.
 * Iki taraf da ayni anda teklif gonderirse "glare" olusur ve el sikisma
 * basarisiz olur; bu kural onu tamamen onler.
 */

/** Bu sayidan sonra peer birakilir; sonsuz yeniden deneme kaynak tuketir. */
const MAX_RECOVERY_ATTEMPTS = 3;

type VideoKind = "camera" | "screen";

interface VideoSlot {
  track: MediaStreamTrack;
  stream: MediaStream;
}

export interface PeerManagerOptions {
  selfUserId: string;
  iceServers: RTCIceServer[];
  sendSignal: (message: Omit<SignalMessage, "fromUserId" | "channelId">) => void;
  onRemoteStream: (userId: string, stream: MediaStream) => void;
  onPeerClosed: (userId: string) => void;
}

export class PeerManager {
  private readonly peers = new Map<string, RTCPeerConnection>();
  /** Uzak taraf henuz hazir degilken gelen adaylar burada bekletilir. */
  private readonly pendingCandidates = new Map<string, RTCIceCandidateInit[]>();
  /** Peer basina ICE restart denemesi; sonsuz donguye girilmesin. */
  private readonly recoveryAttempts = new Map<string, number>();
  /** Su an teklif hazirlanan peer'lar; catisma tespiti icin. */
  private readonly makingOffer = new Set<string>();
  /** Pazarlik surerken istenen ve stable olunca yapilacak yeniden pazarliklar. */
  private readonly pendingRenegotiation = new Set<string>();
  private localStream: MediaStream | null = null;
  /**
   * Giden video yuvalari. Kamera ve ekran bagimsiz: ikisi ayni anda
   * yayinlanabilir. Alici taraf hangi track'in hangisi oldugunu katilimci
   * durumunda tasinan track id'lerinden ayirt eder.
   */
  private camera: VideoSlot | null = null;
  private screen: VideoSlot | null = null;
  private readonly options: PeerManagerOptions;

  constructor(options: PeerManagerOptions) {
    this.options = options;
  }

  setLocalStream(stream: MediaStream) {
    this.localStream = stream;
    for (const [, peer] of this.peers) {
      for (const track of stream.getTracks()) peer.addTrack(track, stream);
    }
  }

  /**
   * Giden track'lerin iliskilendirildigi akis.
   *
   * Video, mikrofonla AYNI akisa baglanmali. Ayri akisla gonderilirse alici
   * tarafta kullanici basina tek akis tutuldugu icin video akisi mikrofonunkinin
   * yerine geciyor ve kamera acildiginda karsi taraf sesi duymayi birakiyordu.
   * Tek akista iki track olunca ses ve goruntu birlikte calisir.
   */
  private outgoingStream(): MediaStream {
    return (this.localStream ?? this.camera?.stream ?? this.screen?.stream) as MediaStream;
  }

  /** Katilimci durumunda yayinlanan track kimlikleri; alici ayirt etsin diye. */
  get cameraTrackId(): string | null {
    return this.camera?.track.id ?? null;
  }

  get screenTrackId(): string | null {
    return this.screen?.track.id ?? null;
  }

  /** Bu taraf mi teklif etmeli? Kucuk id teklif eder. */
  private shouldInitiate(remoteUserId: string) {
    return this.options.selfUserId < remoteUserId;
  }

  /** Teklif etmeyen taraf naziktir: catismada kendi teklifini geri alir. */
  private isPolite(remoteUserId: string) {
    return !this.shouldInitiate(remoteUserId);
  }

  private createPeer(remoteUserId: string): RTCPeerConnection {
    const peer = new RTCPeerConnection({ iceServers: this.options.iceServers });

    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        peer.addTrack(track, this.localStream);
      }
    }

    // Kanala sonradan giren biri de mevcut yayini gormeli; yalnizca mikrofon
    // eklenirse paylasim baslamadan once orada olmayanlar goruntuyu hic almaz.
    const outgoing = this.outgoingStream();
    for (const slot of [this.camera, this.screen]) {
      if (slot) peer.addTrack(slot.track, outgoing);
    }

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        this.options.sendSignal({
          targetUserId: remoteUserId,
          type: "ice-candidate",
          payload: event.candidate.toJSON(),
        });
      }
    };

    peer.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) this.options.onRemoteStream(remoteUserId, stream);
    };

    // Pazarlik bitip stable'a donunce bekleyen yeniden pazarligi calistir.
    peer.onsignalingstatechange = () => {
      if (peer.signalingState !== "stable") return;
      if (this.pendingRenegotiation.delete(remoteUserId)) {
        void this.sendOffer(remoteUserId, peer);
      }
    };

    peer.onconnectionstatechange = () => {
      const state = peer.connectionState;

      if (state === "connected") {
        // Basarili baglanti kurtarma sayacini sifirlar.
        this.recoveryAttempts.delete(remoteUserId);
        return;
      }

      // "disconnected" cogu zaman kendiliginden toparlanir (kisa paket kaybi,
      // NAT yenilenmesi); beklemeden mudahale etmek saglikli baglantiyi koparir.
      if (state === "failed") {
        void this.recoverConnection(remoteUserId, peer);
      } else if (state === "closed") {
        this.removePeer(remoteUserId);
      }
    };

    this.peers.set(remoteUserId, peer);
    return peer;
  }

  /** Kanala yeni biri girdiginde cagrilir. */
  async addPeer(remoteUserId: string) {
    if (this.peers.has(remoteUserId)) return;
    const peer = this.createPeer(remoteUserId);

    if (this.shouldInitiate(remoteUserId)) {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      this.options.sendSignal({ targetUserId: remoteUserId, type: "offer", payload: offer });
    }
  }

  /**
   * Peer kumesini sunucudaki katilimci listesiyle esitler.
   *
   * Baglanti kurulumu tek bir VOICE_JOINED olayina baginca, olay kaybolursa
   * (soket yeniden baglanmasi, gecici kesinti) o cift hic kurulmuyor ve
   * kendini toparlamiyordu -- "uc kisiden ikisi baglaniyor" tam olarak buydu.
   * Periyodik esitleme kurulumu olaydan bagimsiz hale getirir.
   */
  async reconcile(userIds: string[]) {
    const expected = new Set(userIds);

    for (const userId of expected) {
      // addPeer zaten var olan peer'da erken donuyor; tekrar cagirmak zararsiz.
      if (!this.peers.has(userId)) await this.addPeer(userId);
    }

    for (const userId of [...this.peers.keys()]) {
      if (!expected.has(userId)) this.removePeer(userId);
    }
  }

  async handleSignal(message: SignalMessage) {
    const from = message.fromUserId;
    let peer = this.peers.get(from);

    if (!peer) {
      // Teklif once gelmis olabilir; peer'i simdi kur.
      peer = this.createPeer(from);
    }

    if (message.type === "offer") {
      const collision = this.makingOffer.has(from) || peer.signalingState !== "stable";

      // Kaba taraf catismada kendi teklifini korur ve geleni yok sayar; karsi
      // taraf nazik oldugu icin kendi teklifini geri alip bizimkini kabul eder.
      if (collision && !this.isPolite(from)) return;

      if (collision) {
        await peer.setLocalDescription({ type: "rollback" });
      }

      await peer.setRemoteDescription(new RTCSessionDescription(message.payload as RTCSessionDescriptionInit));
      await this.flushCandidates(from, peer);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      this.options.sendSignal({ targetUserId: from, type: "answer", payload: answer });
    } else if (message.type === "answer") {
      await peer.setRemoteDescription(new RTCSessionDescription(message.payload as RTCSessionDescriptionInit));
      await this.flushCandidates(from, peer);
    } else if (message.type === "ice-candidate") {
      const candidate = message.payload as RTCIceCandidateInit;
      // remoteDescription set edilmeden aday eklenemez; sirala.
      if (peer.remoteDescription) {
        await peer.addIceCandidate(candidate).catch(() => undefined);
      } else {
        const queue = this.pendingCandidates.get(from) ?? [];
        queue.push(candidate);
        this.pendingCandidates.set(from, queue);
      }
    }
  }

  private async flushCandidates(userId: string, peer: RTCPeerConnection) {
    const queue = this.pendingCandidates.get(userId);
    if (!queue) return;
    for (const candidate of queue) {
      await peer.addIceCandidate(candidate).catch(() => undefined);
    }
    this.pendingCandidates.delete(userId);
  }

  removePeer(remoteUserId: string) {
    const peer = this.peers.get(remoteUserId);
    if (!peer) return;
    peer.onicecandidate = null;
    peer.ontrack = null;
    peer.onconnectionstatechange = null;
    peer.onsignalingstatechange = null;
    peer.close();
    this.peers.delete(remoteUserId);
    this.pendingCandidates.delete(remoteUserId);
    this.recoveryAttempts.delete(remoteUserId);
    this.makingOffer.delete(remoteUserId);
    this.pendingRenegotiation.delete(remoteUserId);
    this.options.onPeerClosed(remoteUserId);
  }

  setMicrophoneEnabled(enabled: boolean) {
    // Track'i durdurmak yerine devre disi birakmak baglantiyi acik tutar;
    // yeniden acmak icin renegotiation gerekmez.
    for (const track of this.localStream?.getAudioTracks() ?? []) {
      track.enabled = enabled;
    }
  }

  /** Ekran paylasimini baslatir; her peer'a track eklenir ve yeniden pazarlik olur. */
  async startScreenShare(): Promise<MediaStream> {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    return this.publishVideo("screen", stream);
  }

  /** Kamerayi acar. Ekran paylasimini etkilemez; ikisi birlikte yayinlanabilir. */
  async startCamera(video: MediaTrackConstraints): Promise<MediaStream> {
    const stream = await navigator.mediaDevices.getUserMedia({ video });
    return this.publishVideo("camera", stream);
  }

  async stopCamera() {
    await this.unpublishVideo("camera");
  }

  async stopScreenShare() {
    await this.unpublishVideo("screen");
  }

  /**
   * Mikrofon track'ini degistirir: aygit secimi veya gurultu engelleme ayari
   * degistiginde cagrilir.
   *
   * replaceTrack ayni turde bir track icin SDP yeniden pazarligi gerektirmez,
   * yani konusma kesintiye ugramaz. Track'in enabled durumu korunur; aksi
   * halde susturulmus bir mikrofon aygit degisiminde kendiliginden acilirdi.
   */
  async replaceAudioTrack(track: MediaStreamTrack) {
    const previous = this.localStream?.getAudioTracks()[0] ?? null;
    if (previous) track.enabled = previous.enabled;

    for (const [, peer] of this.peers) {
      const sender = peer.getSenders().find((s) => s.track?.kind === "audio");
      if (sender) await sender.replaceTrack(track);
    }

    if (this.localStream) {
      if (previous) {
        this.localStream.removeTrack(previous);
        previous.stop();
      }
      this.localStream.addTrack(track);
    }
  }

  /** Her iki video yayinini da durdurur (kanaldan cikarken). */
  async stopVideo() {
    await this.unpublishVideo("camera");
    await this.unpublishVideo("screen");
  }

  private async publishVideo(kind: VideoKind, stream: MediaStream): Promise<MediaStream> {
    // Ayni turden onceki yayin varsa once o kapatilir; digerine dokunulmaz.
    await this.unpublishVideo(kind);

    const [track] = stream.getVideoTracks();
    const slot: VideoSlot = { track, stream };
    if (kind === "camera") this.camera = slot;
    else this.screen = slot;

    // Kullanici tarayicinin kendi "paylasimi durdur" butonuna basarsa.
    track.onended = () => void this.unpublishVideo(kind);

    const outgoing = this.outgoingStream();
    for (const [userId, peer] of this.peers) {
      peer.addTrack(track, outgoing);
      await this.renegotiate(userId, peer);
    }
    return stream;
  }

  private async unpublishVideo(kind: VideoKind) {
    const slot = kind === "camera" ? this.camera : this.screen;
    if (!slot) return;

    // Once yuvayi bosalt: track.onended bu cagriyi tekrar tetikleyebilir.
    if (kind === "camera") this.camera = null;
    else this.screen = null;

    slot.track.onended = null;
    slot.track.stop();

    for (const [userId, peer] of this.peers) {
      const sender = peer.getSenders().find((s) => s.track === slot.track);
      if (sender) {
        peer.removeTrack(sender);
        await this.renegotiate(userId, peer);
      }
    }
  }

  /**
   * Kopan baglantiyi ICE restart ile toparlamayi dener.
   *
   * Onceden "failed" durumunda peer dogrudan siliniyordu ve bir daha
   * kurulmuyordu -- WiFi gecisi veya kisa bir kesinti sesin kalici olarak
   * gitmesine yol aciyordu. ICE restart yeni aday toplayarak baglantiyi
   * yeniden kurar; medya akisi ve peer nesnesi korunur.
   */
  private async recoverConnection(remoteUserId: string, peer: RTCPeerConnection) {
    // Yalnizca teklif eden taraf baslatir: iki taraf ayni anda ICE restart
    // denerse glare olusur ve el sikisma yine basarisiz olur.
    if (!this.shouldInitiate(remoteUserId)) return;

    const attempts = (this.recoveryAttempts.get(remoteUserId) ?? 0) + 1;
    if (attempts > MAX_RECOVERY_ATTEMPTS) {
      this.removePeer(remoteUserId);
      return;
    }
    this.recoveryAttempts.set(remoteUserId, attempts);

    try {
      await this.sendOffer(remoteUserId, peer, { iceRestart: true });
    } catch {
      this.removePeer(remoteUserId);
    }
  }

  /**
   * Teklif gonderir. Pazarlik zaten suruyorsa erteler: uctaki bir teklifin
   * uzerine ikincisini yollamak setRemoteDescription'i patlatir ve baglantiyi
   * bozar -- kamera veya ekran acilinca sesin kesilmesinin sebebi buydu.
   */
  private async sendOffer(
    userId: string,
    peer: RTCPeerConnection,
    options?: RTCOfferOptions,
  ) {
    if (peer.signalingState !== "stable") {
      this.pendingRenegotiation.add(userId);
      return;
    }

    this.makingOffer.add(userId);
    try {
      const offer = await peer.createOffer(options);
      // await sirasinda durum degismis olabilir.
      if (peer.signalingState !== "stable") {
        this.pendingRenegotiation.add(userId);
        return;
      }
      await peer.setLocalDescription(offer);
      this.options.sendSignal({ targetUserId: userId, type: "offer", payload: offer });
    }
    finally {
      this.makingOffer.delete(userId);
    }
  }

  private async renegotiate(userId: string, peer: RTCPeerConnection) {
    await this.sendOffer(userId, peer);
  }

  closeAll() {
    for (const userId of [...this.peers.keys()]) this.removePeer(userId);
    for (const track of this.localStream?.getTracks() ?? []) track.stop();
    this.localStream = null;
    void this.stopVideo();
  }
}
