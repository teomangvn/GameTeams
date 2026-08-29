import { useEffect, useState } from "react";

import { Field, SubmitButton, TextInput } from "@/features/auth/AuthLayout";

/**
 * Tek alanli diyalog. window.prompt yerine kullanilir: tarayici prompt'u
 * stil alamaz, klavye ile kapatilamaz ve mobilde kotu davranir.
 */
export function PromptDialog({
  open,
  title,
  description,
  label,
  placeholder,
  submitLabel = "Tamam",
  loading,
  onSubmit,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  label: string;
  placeholder?: string;
  submitLabel?: string;
  loading?: boolean;
  onSubmit: (value: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState("");

  useEffect(() => {
    if (open) setValue("");
  }, [open]);

  // Escape ile kapanma, tarayici prompt'unda olmayan bir kolaylik.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-sm bg-black border border-neutral-800 rounded-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-lexend font-semibold text-[18px] text-neutral-50">{title}</h2>
        {description && (
          <p className="font-lexend text-[13px] text-neutral-400 mt-1.5 leading-relaxed">
            {description}
          </p>
        )}

        <form
          className="mt-5 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = value.trim();
            if (trimmed) onSubmit(trimmed);
          }}
        >
          <Field label={label}>
            <TextInput
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={placeholder}
              autoFocus
              required
            />
          </Field>
          <SubmitButton loading={loading}>{submitLabel}</SubmitButton>
        </form>
      </div>
    </div>
  );
}

export default PromptDialog;
