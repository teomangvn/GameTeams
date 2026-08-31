import { useEffect, useState } from "react";
import { Chat, Microphone } from "@carbon/icons-react";

import type { ChannelType } from "@/api/rooms";
import { Field, SubmitButton, TextInput } from "@/features/auth/AuthLayout";
import { cn } from "@/lib/utils";

/**
 * Kanal olusturma diyalogu.
 *
 * Tur secimi sart: onceden yalnizca metin kanali uretilebiliyordu, ses kanali
 * acmanin arayuzde karsiligi yoktu.
 */
export function CreateChannelDialog({
  open,
  loading,
  onSubmit,
  onClose,
}: {
  open: boolean;
  loading?: boolean;
  onSubmit: (name: string, type: ChannelType) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<ChannelType>("TEXT");

  useEffect(() => {
    if (open) {
      setName("");
      setType("TEXT");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const trimmed = name.trim();

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-sm bg-black border border-neutral-800 rounded-2xl p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="font-lexend font-semibold text-[18px] text-neutral-50">Kanal oluştur</h2>
        <p className="font-lexend text-[13px] text-neutral-400 mt-1.5 leading-relaxed">
          Ses kanallarının da kendi sohbeti vardır.
        </p>

        <form
          className="mt-5 flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (trimmed) onSubmit(trimmed, type);
          }}
        >
          <fieldset>
            <legend className="font-lexend text-[13px] text-neutral-300 mb-1.5">
              Kanal türü
            </legend>
            <div className="grid grid-cols-2 gap-2">
              <TypeOption
                selected={type === "TEXT"}
                onSelect={() => setType("TEXT")}
                icon={<Chat size={16} />}
                label="Metin"
                hint="Yazışma"
              />
              <TypeOption
                selected={type === "VOICE"}
                onSelect={() => setType("VOICE")}
                icon={<Microphone size={16} />}
                label="Ses"
                hint="Konuşma + sohbet"
              />
            </div>
          </fieldset>

          <Field label="Kanal adı">
            <TextInput
              autoFocus
              value={name}
              maxLength={64}
              placeholder={type === "TEXT" ? "strateji" : "Genel"}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>

          <SubmitButton loading={loading}>Oluştur</SubmitButton>
        </form>
      </div>
    </div>
  );
}

function TypeOption({
  selected,
  onSelect,
  icon,
  label,
  hint,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "rounded-lg border px-3 py-2.5 text-left transition-colors",
        selected
          ? "border-neutral-500 bg-neutral-900"
          : "border-neutral-800 hover:bg-neutral-900/60",
      )}
    >
      <span className="flex items-center gap-2 font-lexend text-[14px] text-neutral-50">
        {icon}
        {label}
      </span>
      <span className="block font-lexend text-[12px] text-neutral-500 mt-0.5">{hint}</span>
    </button>
  );
}

export default CreateChannelDialog;
