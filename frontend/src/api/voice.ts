import { request } from "@/api/client";

export interface VoiceParticipant {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  muted: boolean;
  deafened: boolean;
  screenSharing: boolean;
  cameraOn: boolean;
  /** Tek akista iki video tasinabilir; hangisinin hangisi oldugunu bunlar soyler. */
  cameraTrackId: string | null;
  screenTrackId: string | null;
}

export type VoiceEvent = {
  type: "VOICE_JOINED" | "VOICE_LEFT" | "VOICE_STATE";
  channelId: string;
  participant: VoiceParticipant;
};

export interface SignalMessage {
  targetUserId: string;
  fromUserId: string;
  channelId: string;
  type: "offer" | "answer" | "ice-candidate";
  payload: unknown;
}

interface IceServersResponse {
  iceServers: RTCIceServer[];
}

export const voiceApi = {
  iceServers: () => request<IceServersResponse>("/api/webrtc/ice-servers"),

  participants: (channelId: string) =>
    request<VoiceParticipant[]>(`/api/voice/channels/${channelId}/participants`),
};
