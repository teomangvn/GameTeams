import { useEffect, useRef } from "react";
import { PhoneFilled, PhoneOff } from "@carbon/icons-react";

import type { CallParty } from "@/api/voice";

/**
 * Gelen arama penceresi. Uygulamanin her yerinde (ayar penceresi acikken de)
 * gorunmesi icin ses provider'inda cizilir.
 */
export function IncomingCallDialog({
  caller,
  onAccept,
  onDecline,
}: {
  caller: CallParty | null;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const acceptRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!caller) return;
    acceptRef.current?.focus();
  }, [caller]);

  if (!caller) return null;

  return (
    <div
      role="alertdialog"
      aria-label={`${caller.displayName} seni arıyor`}
      className="fixed top-6 left-1/2 -translate-x-1/2 z-[60] w-[min(22rem,calc(100vw-2rem))]
                 rounded-2xl border border-neutral-700 bg-neutral-900/95 backdrop-blur
                 shadow-2xl shadow-black/60 p-4 animate-in fade-in slide-in-from-top-4 duration-200"
    >
      <div className="flex items-center gap-3">
        <span className="relative shrink-0">
          <span className="absolute inset-0 rounded-full bg-emerald-500/40 animate-ping" />
          {caller.avatarUrl ? (
            <img
              src={caller.avatarUrl}
              alt=""
              className="relative size-12 rounded-full object-cover border border-neutral-700"
            />
          ) : (
            <span className="relative size-12 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center font-lexend font-semibold text-[16px] text-neutral-200">
              {caller.displayName.slice(0, 1).toUpperCase()}
            </span>
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="font-lexend font-semibold text-[15px] text-neutral-50 truncate">
            {caller.displayName}
          </div>
          <div className="font-lexend text-[13px] text-neutral-400">Sesli arama geliyor…</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onDecline}
          className="h-10 rounded-lg inline-flex items-center justify-center gap-2 font-lexend text-[14px]
                     bg-red-500/15 text-red-300 hover:bg-red-500/25 transition-colors"
        >
          <PhoneOff size={16} />
          Reddet
        </button>
        <button
          ref={acceptRef}
          type="button"
          onClick={onAccept}
          className="h-10 rounded-lg inline-flex items-center justify-center gap-2 font-lexend font-semibold text-[14px]
                     bg-emerald-500 text-neutral-950 hover:bg-emerald-400 transition-colors"
        >
          <PhoneFilled size={16} />
          Kabul et
        </button>
      </div>
    </div>
  );
}

export default IncomingCallDialog;
