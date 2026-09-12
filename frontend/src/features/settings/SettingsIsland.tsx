import { useEffect, useRef } from "react";
import { Close, Microphone, UserAvatar } from "@carbon/icons-react";

import ProfilePage from "@/features/profile/ProfilePage";
import DeviceSettingsPage from "@/features/settings/DeviceSettingsPage";
import { cn } from "@/lib/utils";

export type SettingsTab = "profile" | "devices";

const TABS: Array<{ id: SettingsTab; label: string; icon: React.ReactNode }> = [
  { id: "devices", label: "Ses ve görüntü", icon: <Microphone size={16} /> },
  { id: "profile", label: "Profil", icon: <UserAvatar size={16} /> },
];

/**
 * Uygulamanin uzerinde acilan ayar penceresi.
 *
 * Ayarlar onceden ayri bir sayfaydi: girip cikmak butun uygulamayi yeniden
 * kuruyor, ses izgarasi ve secili kanal kayboluyordu. Pencere uygulamayi
 * yerinde birakir; Esc, disari tiklama veya X ile kapanir.
 */
export function SettingsIsland({
  tab,
  onTabChange,
  onClose,
}: {
  tab: SettingsTab | null;
  onTabChange: (tab: SettingsTab) => void;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const open = tab !== null;

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4
                 animate-in fade-in duration-150"
      onPointerDown={(event) => {
        // Yalnizca arka plana tiklamak kapatir; pencere icindeki surukleme
        // disarida biterse kapanmasin diye pointerdown hedefine bakiliyor.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ayarlar"
        className="w-full max-w-3xl h-[min(88vh,900px)] flex flex-col rounded-2xl overflow-hidden
                   border border-neutral-800 bg-[#141414] shadow-2xl shadow-black/60
                   animate-in zoom-in-95 duration-150"
      >
        <header className="shrink-0 flex items-center gap-2 border-b border-neutral-800 px-4 sm:px-6 h-14">
          <h2 className="font-lexend font-semibold text-[16px] text-neutral-50 mr-2">Ayarlar</h2>

          <nav className="flex items-center gap-1 min-w-0" aria-label="Ayar bölümleri">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                aria-current={item.id === tab ? "page" : undefined}
                className={cn(
                  "h-8 px-2.5 rounded-md inline-flex items-center gap-1.5 shrink-0",
                  "font-lexend text-[13px] transition-colors",
                  item.id === tab
                    ? "bg-neutral-800 text-neutral-50"
                    : "text-neutral-400 hover:bg-neutral-800/70 hover:text-neutral-100",
                )}
              >
                {item.icon}
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            ))}
          </nav>

          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            title="Kapat (Esc)"
            aria-label="Ayarları kapat"
            className="ml-auto size-9 rounded-full flex items-center justify-center text-neutral-400
                       hover:bg-neutral-800 hover:text-neutral-50 transition-colors"
          >
            <Close size={20} />
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 pb-6">
          {tab === "devices" ? <DeviceSettingsPage embedded /> : <ProfilePage embedded />}
        </div>
      </div>
    </div>
  );
}

export default SettingsIsland;
