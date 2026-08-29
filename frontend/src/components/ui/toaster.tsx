import { Close } from "@carbon/icons-react";

import { useToastStore, type ToastTone } from "@/stores/toastStore";
import { cn } from "@/lib/utils";

const toneClass: Record<ToastTone, string> = {
  error: "border-red-500/40 bg-red-500/10 text-red-200",
  success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  info: "border-neutral-700 bg-neutral-900 text-neutral-200",
};

/** Ekranin sag altinda biriken bildirimler. */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 w-full max-w-sm px-4"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "flex items-start gap-3 rounded-lg border px-3 py-2.5 backdrop-blur",
            "font-lexend text-[13px] leading-relaxed shadow-lg",
            toneClass[t.tone],
          )}
        >
          <span className="flex-1">{t.message}</span>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            aria-label="Kapat"
            className="shrink-0 opacity-60 hover:opacity-100"
          >
            <Close size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}

export default Toaster;
