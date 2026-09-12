import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

/**
 * Onay penceresi. Geri alinamayan islemler (arkadasliktan cikarma, engelleme,
 * odadan ayrilma, oda silme) tek tiklamayla yapilmasin diye kullanilir.
 * window.confirm stil alamiyor ve uygulamadan kopuk gorunuyordu.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  danger = false,
  loading = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    // Varsayilan odak "Vazgec"te: Enter'a yanlislikla basmak islemi yapmasin.
    cancelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loading) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, loading, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={() => !loading && onClose()}
      role="presentation"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-sm bg-black border border-neutral-800 rounded-2xl p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="font-lexend font-semibold text-[18px] text-neutral-50">{title}</h2>
        {description && (
          <p className="font-lexend text-[13px] text-neutral-400 mt-2 leading-relaxed">
            {description}
          </p>
        )}

        <div className="mt-6 grid grid-cols-2 gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            disabled={loading}
            className="h-10 rounded-lg font-lexend text-[14px] text-neutral-200 border border-neutral-700 hover:bg-neutral-800 transition-colors disabled:opacity-50"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              "h-10 rounded-lg font-lexend font-semibold text-[14px] transition-colors disabled:opacity-50",
              danger
                ? "bg-red-500 text-white hover:bg-red-400"
                : "bg-neutral-50 text-neutral-950 hover:bg-white",
            )}
          >
            {loading ? "Lütfen bekle..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
