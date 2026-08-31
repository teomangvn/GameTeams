import type { SignalMessage } from "@/api/voice";

/**
 * WebRTC mesh yoneticisi: kanaldaki her katilimci icin ayri bir
 * RTCPeerConnection tutar.
 *
 * Teklif kuralı deterministiktir — id'si kucuk olan taraf teklifi baslatir.
 * Iki taraf da ayni anda teklif gonderirse "glare" olusur ve el sikisma
 * basarisiz olur; bu kural onu tamamen onler.
 */

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
  private localStream: MediaStream | null = null;
  /**
   * Giden video: kamera ya da ekran, ikisi birden degil. Mesh'te kisi basina
   * tek video track tasiniyor ve alici taraf gelen goruntunun hangisi oldugunu
   * ancak katilimci durumundaki bayraklardan anliyor.
   */
  private videoTrack: MediaStreamTrack | null = null;
  private videoStream: MediaStream | null = null;
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

  /** Bu taraf mi teklif etmeli? Kucuk id teklif eder. */
  private shouldInitiate(remoteUserId: string) {
    return this.options.selfUserId < remoteUserId;
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
    if (this.videoTrack && this.videoStream) {
      peer.addTrack(this.videoTrack, this.videoStream);
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

    peer.onconnectionstatechange = () => {
      if (["failed", "closed"].includes(peer.connectionState)) {
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

  async handleSignal(message: SignalMessage) {
    const from = message.fromUserId;
    let peer = this.peers.get(from);

    if (!peer) {
      // Teklif once gelmis olabilir; peer'i simdi kur.
      peer = this.createPeer(from);
    }

    if (message.type === "offer") {
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
    peer.close();
    this.peers.delete(remoteUserId);
    this.pendingCandidates.delete(remoteUserId);
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
    return this.publishVideo(stream);
  }

  /** Kamerayi acar. Ekran paylasimi aciksa once o kapatilir. */
  async startCamera(): Promise<MediaStream> {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 } },
    });
    return this.publishVideo(stream);
  }

  /** Giden videoyu (kamera veya ekran) durdurur. */
  async stopVideo() {
    const track = this.videoTrack;
    if (!track) return;

    // Once alanlari temizle: track.onended bu cagriyi tekrar tetikleyebilir.
    this.videoTrack = null;
    this.videoStream = null;
    track.onended = null;
    track.stop();

    for (const [userId, peer] of this.peers) {
      const sender = peer.getSenders().find((s) => s.track === track);
      if (sender) {
        peer.removeTrack(sender);
        await this.renegotiate(userId, peer);
      }
    }
  }

  private async publishVideo(stream: MediaStream): Promise<MediaStream> {
    // Kamera ve ekran ayni anda yayinlanmaz; yenisi eskisinin yerini alir.
    await this.stopVideo();

    const [track] = stream.getVideoTracks();
    this.videoTrack = track;
    this.videoStream = stream;

    // Kullanici tarayicinin kendi "paylasimi durdur" butonuna basarsa.
    track.onended = () => void this.stopVideo();

    for (const [userId, peer] of this.peers) {
      peer.addTrack(track, stream);
      await this.renegotiate(userId, peer);
    }
    return stream;
  }

  private async renegotiate(userId: string, peer: RTCPeerConnection) {
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    this.options.sendSignal({ targetUserId: userId, type: "offer", payload: offer });
  }

  closeAll() {
    for (const userId of [...this.peers.keys()]) this.removePeer(userId);
    for (const track of this.localStream?.getTracks() ?? []) track.stop();
    this.localStream = null;
    void this.stopVideo();
  }
}
