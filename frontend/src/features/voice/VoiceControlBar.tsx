import {
  Microphone,
  MicrophoneOff,
  Headphones,
  VolumeMute,
  Screen,
  ScreenOff,
  PhoneOff,
  SignalStrength,
} from "@carbon/icons-react";

import { cn } from "@/lib/utils";

/**
 * Ses kanalına bağlıyken kenar çubuğunun altında duran kontrol çubuğu.
 * Route değişse de bağlantı yaşar; bu yüzden durum yukarıdan prop olarak gelir,
 * komponent kendi state'ini tutmaz.
 */

export interface VoiceControlBarProps {
  channelName: string;
  roomName: string;
  /** Kanaldaki toplam kisi sayisi (kendisi dahil). */
  participantCount?: number;
  muted: boolean;
  deafened: boolean;
  screenSharing: boolean;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onToggleScreenShare: () => void;
  onDisconnect: () => void;
}

function ControlButton({
  label,
  active,
  danger,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={danger ? undefined : active}
      className={cn(
        "size-8 rounded-md flex items-center justify-center transition-colors shrink-0",
        danger
          ? "text-neutral-400 hover:bg-red-500/15 hover:text-red-400"
          : active
            ? "bg-red-500/15 text-red-400 hover:bg-red-500/25"
            : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100",
      )}
    >
      {children}
    </button>
  );
}

export function VoiceControlBar({
  channelName,
  roomName,
  participantCount,
  muted,
  deafened,
  screenSharing,
  onToggleMute,
  onToggleDeafen,
  onToggleScreenShare,
  onDisconnect,
}: VoiceControlBarProps) {
  return (
    <div className="w-full rounded-lg bg-neutral-900/80 border border-neutral-800 px-3 py-2 flex flex-col gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <SignalStrength size={16} className="text-emerald-500 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="font-lexend text-[12px] text-emerald-500 leading-tight">
            Ses bağlandı{participantCount !== undefined && ` · ${participantCount} kişi`}
          </div>
          <div className="font-lexend text-[12px] text-neutral-400 truncate leading-tight">
            {channelName} / {roomName}
          </div>
        </div>
        <ControlButton label="Sesten ayrıl" danger onClick={onDisconnect}>
          <PhoneOff size={16} />
        </ControlButton>
      </div>

      <div className="flex items-center gap-1">
        <ControlButton
          label={muted ? "Mikrofonu aç" : "Mikrofonu kapat"}
          active={muted}
          onClick={onToggleMute}
        >
          {muted ? <MicrophoneOff size={16} /> : <Microphone size={16} />}
        </ControlButton>

        <ControlButton
          label={deafened ? "Sesi aç" : "Sesi kapat"}
          active={deafened}
          onClick={onToggleDeafen}
        >
          {deafened ? <VolumeMute size={16} /> : <Headphones size={16} />}
        </ControlButton>

        <ControlButton
          label={screenSharing ? "Paylaşımı durdur" : "Ekranı paylaş"}
          active={screenSharing}
          onClick={onToggleScreenShare}
        >
          {screenSharing ? <ScreenOff size={16} /> : <Screen size={16} />}
        </ControlButton>
      </div>
    </div>
  );
}

export default VoiceControlBar;
