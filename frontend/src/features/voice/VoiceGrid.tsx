import { useEffect, useRef } from "react";
import {
  Chat,
  MicrophoneOff,
  Share,
  Video,
  VideoOff,
  VolumeMute,
} from "@carbon/icons-react";

import type { VoiceParticipant } from "@/api/voice";
import type { VoiceSession } from "@/features/voice/useVoiceSession";
import { useSpeakingDetection } from "@/features/voice/useSpeaking";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";

/**
 * Ses kanalinin ana gorunumu: her katilimci icin bir kare.
 *
 * Kamera veya ekran yayini varsa video, yoksa profil fotografi gosterilir.
 * Kare sayisi arttikca izgara sutun sayisi buyur, boylece kareler ekrani
 * dengeli boler.
 */
export function VoiceGrid({
  session,
  chatOpen,
  onToggleChat,
}: {
  session: VoiceSession;
  chatOpen: boolean;
  onToggleChat: () => void;
}) {
  const self = useAuthStore((s) => s.user);

  // Konusma gostergesi icin ses tasiyan tum akislar: kendi mikrofonumuz ve
  // uzak katilimcilar. Seviye yerelde olculur, sunucuya ek sinyal gitmez.
  const audioStreams: Record<string, MediaStream> = {};
  if (session.localAudio) audioStreams.self = session.localAudio;
  for (const participant of session.participants) {
    const stream = session.remoteStreams[participant.userId];
    if (stream) audioStreams[participant.userId] = stream;
  }
  const speaking = useSpeakingDetection(audioStreams);

  const tiles: TileData[] = [
    {
      key: "self",
      name: self?.displayName ?? "Sen",
      avatarUrl: self?.avatarUrl ?? null,
      muted: session.muted,
      deafened: session.deafened,
      screenSharing: session.screenSharing,
      cameraOn: session.cameraOn,
      stream: session.localVideo,
      isSelf: true,
      // Susturulmusken cerceve yanmasin: track devre disi oldugu icin analyser
      // zaten sessizlik gorur, ama deafened durumunda da acikca kapatiyoruz.
      speaking: speaking.has("self") && !session.muted,
    },
    ...session.participants.map((participant) => ({
      key: participant.userId,
      name: participant.displayName,
      avatarUrl: participant.avatarUrl,
      muted: participant.muted,
      deafened: participant.deafened,
      screenSharing: participant.screenSharing,
      cameraOn: participant.cameraOn,
      stream: streamWithVideo(session, participant),
      isSelf: false,
      speaking: speaking.has(participant.userId) && !participant.muted,
    })),
  ];

  return (
    <div className="flex-1 min-w-0 bg-neutral-950 flex flex-col">
      <header className="h-14 shrink-0 border-b border-neutral-800 flex items-center gap-2 px-6">
        <Video size={18} className="text-neutral-400 shrink-0" />
        <h2 className="font-lexend font-semibold text-[15px] text-neutral-50 truncate">
          {session.channelName}
        </h2>
        <span className="font-lexend text-[13px] text-neutral-500 truncate">
          {session.roomName}
        </span>
        <span className="ml-auto font-lexend text-[13px] text-neutral-500 shrink-0">
          {tiles.length} kişi
        </span>

        <button
          type="button"
          onClick={onToggleChat}
          aria-pressed={chatOpen}
          title="Kanal sohbeti"
          className={cn(
            "ml-2 h-8 px-2.5 rounded-md shrink-0 inline-flex items-center gap-1.5",
            "font-lexend text-[13px] transition-colors",
            chatOpen
              ? "bg-neutral-800 text-neutral-100"
              : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100",
          )}
        >
          <Chat size={16} />
          Sohbet
        </button>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        <div
          className="grid gap-3 h-full auto-rows-fr"
          style={{ gridTemplateColumns: `repeat(${columnsFor(tiles.length)}, minmax(0, 1fr))` }}
        >
          {tiles.map((tile) => (
            <Tile key={tile.key} tile={tile} />
          ))}
        </div>
      </div>
    </div>
  );
}

interface TileData {
  key: string;
  name: string;
  avatarUrl: string | null;
  muted: boolean;
  deafened: boolean;
  screenSharing: boolean;
  cameraOn: boolean;
  stream: MediaStream | null;
  isSelf: boolean;
  speaking: boolean;
}

/**
 * Sutun sayisi. Kare sayisi az oldugunda genis kareler, kalabalikta daha cok
 * sutun; mesh tavani 8 kisi oldugu icin 4 sutun pratikte yeterli.
 */
function columnsFor(count: number): number {
  if (count <= 1) return 1;
  if (count <= 4) return 2;
  if (count <= 9) return 3;
  return 4;
}

/** Katilimcinin video tasiyan akisi; yoksa null (profil fotografi gosterilir). */
function streamWithVideo(session: VoiceSession, participant: VoiceParticipant): MediaStream | null {
  if (!participant.cameraOn && !participant.screenSharing) return null;
  const stream = session.remoteStreams[participant.userId];
  return stream && stream.getVideoTracks().length > 0 ? stream : null;
}

function Tile({ tile }: { tile: TileData }) {
  const showVideo = Boolean(tile.stream) && (tile.cameraOn || tile.screenSharing);

  return (
    <figure
      className={cn(
        "relative min-h-40 rounded-xl overflow-hidden bg-black border flex items-center justify-center",
        "transition-shadow duration-150",
        tile.screenSharing ? "border-emerald-500/40" : "border-neutral-800",
        // Konusan kisinin cercevesi: ring, border'in yerini almaz ustune biner,
        // boylece ekran paylasimi rengi kaybolmaz ve kare ziplamaz.
        tile.speaking && "ring-2 ring-emerald-400 ring-offset-0",
      )}
    >
      {showVideo ? (
        <TileVideo
          stream={tile.stream as MediaStream}
          // Kendi kameranda ayna goruntusu beklenir; ekran paylasiminda beklenmez.
          mirrored={tile.isSelf && tile.cameraOn}
          // Kendi sesini geri duymamak icin daima sessiz. Uzak sesler
          // VoiceStage'deki <audio> uzerinden calinir; burada iki kez calmasin.
        />
      ) : (
        <Avatar name={tile.name} avatarUrl={tile.avatarUrl} />
      )}

      <figcaption className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 px-3 py-2 bg-gradient-to-t from-black/80 to-transparent">
        <span className="font-lexend text-[13px] text-neutral-50 truncate">
          {tile.name}
          {tile.isSelf && <span className="text-neutral-400"> (sen)</span>}
        </span>

        <span className="ml-auto flex items-center gap-1.5 shrink-0 text-neutral-300">
          {tile.screenSharing && <Share size={14} className="text-emerald-400" />}
          {tile.cameraOn ? <Video size={14} /> : <VideoOff size={14} className="text-neutral-500" />}
          {tile.deafened ? (
            <VolumeMute size={14} className="text-red-400" />
          ) : (
            tile.muted && <MicrophoneOff size={14} className="text-red-400" />
          )}
        </span>
      </figcaption>
    </figure>
  );
}

function Avatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className="size-24 rounded-full object-cover border border-neutral-800"
      />
    );
  }

  return (
    <div className="size-24 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center">
      <span className="font-lexend font-semibold text-[28px] text-neutral-300">
        {initials(name)}
      </span>
    </div>
  );
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function TileVideo({ stream, mirrored }: { stream: MediaStream; mirrored: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.srcObject = stream;
    void element.play().catch(() => undefined);
  }, [stream]);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted
      className={cn("size-full object-contain bg-black", mirrored && "scale-x-[-1]")}
    />
  );
}

export default VoiceGrid;
