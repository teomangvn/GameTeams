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
  private screenTrack: MediaStreamTrack | null = null;
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
    const [track] = stream.getVideoTracks();
    this.screenTrack = track;

    // Kullanici tarayicinin kendi "paylasimi durdur" butonuna basarsa.
    track.onended = () => void this.stopScreenShare();

    for (const [userId, peer] of this.peers) {
      peer.addTrack(track, stream);
      await this.renegotiate(userId, peer);
    }
    return stream;
  }

  async stopScreenShare() {
    if (!this.screenTrack) return;
    this.screenTrack.stop();

    for (const [userId, peer] of this.peers) {
      const sender = peer.getSenders().find((s) => s.track === this.screenTrack);
      if (sender) {
        peer.removeTrack(sender);
        await this.renegotiate(userId, peer);
      }
    }
    this.screenTrack = null;
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
    void this.stopScreenShare();
  }
}
