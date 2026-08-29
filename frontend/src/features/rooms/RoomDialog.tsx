import { useState } from "react";

import { ApiError } from "@/api/client";
import { Field, FormAlert, SubmitButton, TextInput } from "@/features/auth/AuthLayout";
import { useCreateRoom, useJoinRoom } from "@/features/rooms/queries";
import { cn } from "@/lib/utils";

type Tab = "create" | "join";

/** Oda olusturma ve davet koduyla katilma icin tek diyalog. */
export function RoomDialog({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: (roomId: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("create");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createRoom = useCreateRoom();
  const joinRoom = useJoinRoom();

  if (!open) return null;

  const reset = () => {
    setName("");
    setDescription("");
    setInviteCode("");
    setError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      const room =
        tab === "create"
          ? await createRoom.mutateAsync({ name, description, isPublic: false })
          : await joinRoom.mutateAsync(inviteCode);
      reset();
      onDone(room.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Islem basarisiz.");
    }
  };

  const loading = createRoom.isPending || joinRoom.isPending;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={close}
      role="presentation"
    >
      <div
        className="w-full max-w-md bg-black border border-neutral-800 rounded-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex gap-1 p-1 bg-neutral-900 rounded-lg mb-5">
          {(["create", "join"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setTab(value);
                setError(null);
              }}
              className={cn(
                "flex-1 h-9 rounded-md font-lexend text-[13px] transition-colors",
                tab === value
                  ? "bg-neutral-800 text-neutral-50"
                  : "text-neutral-400 hover:text-neutral-200",
              )}
            >
              {value === "create" ? "Oda oluştur" : "Davetle katıl"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && <FormAlert tone="error">{error}</FormAlert>}

          {tab === "create" ? (
            <>
              <Field label="Oda adı">
                <TextInput
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Valorant Türkiye"
                  required
                />
              </Field>
              <Field label="Açıklama (opsiyonel)">
                <TextInput
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ne için kurdun?"
                />
              </Field>
            </>
          ) : (
            <Field label="Davet kodu">
              <TextInput
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="Arkadaşından aldığın kod"
                required
              />
            </Field>
          )}

          <SubmitButton loading={loading}>
            {tab === "create" ? "Oluştur" : "Katıl"}
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}

export default RoomDialog;
