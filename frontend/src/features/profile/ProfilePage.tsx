import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Camera, TrashCan, User as UserIcon } from "@carbon/icons-react";

import { ApiError } from "@/api/client";
import { usersApi } from "@/api/users";
import { Field, FormAlert, SelectInput, SubmitButton, TextInput } from "@/features/auth/AuthLayout";
import { LANGUAGES, REGIONS, withCurrent } from "@/lib/profileOptions";
import { cn } from "@/lib/utils";
import { toast } from "@/stores/toastStore";
import { useAuthStore } from "@/stores/authStore";

/** Tarayicida da sinirla: 2 MB'lik sunucu limitine bosuna yukleme yapilmasin. */
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ACCEPTED = "image/png,image/jpeg,image/webp,image/gif";

export function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const fileInput = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [region, setRegion] = useState(user?.region ?? "");
  const [language, setLanguage] = useState(user?.language ?? "");

  if (!user) return null;

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const updated = await usersApi.updateProfile({ displayName, bio, region, language });
      setUser(updated);
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Profil kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  const handlePick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Ayni dosyayi tekrar secebilmek icin input'u sifirla.
    event.target.value = "";
    if (!file) return;

    if (file.size > MAX_AVATAR_BYTES) {
      toast.error("Görsel en fazla 2 MB olabilir.");
      return;
    }

    setUploading(true);
    try {
      setUser(await usersApi.uploadAvatar(file));
      toast.success("Profil fotoğrafın güncellendi.");
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Görsel yüklenemedi.");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setUploading(true);
    try {
      setUser(await usersApi.removeAvatar());
      toast.success("Profil fotoğrafın kaldırıldı.");
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "Görsel kaldırılamadı.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a] p-4 sm:p-8">
      <div className="mx-auto max-w-2xl">
        <Link
          to="/"
          className="inline-flex items-center gap-2 font-lexend text-[13px] text-neutral-400 hover:text-neutral-200"
        >
          <ArrowLeft size={16} /> Uygulamaya dön
        </Link>

        <h1 className="font-lexend font-semibold text-[24px] text-neutral-50 mt-4">Profil</h1>

        {/* --- Profil fotografi --- */}
        <section className="mt-6 rounded-2xl border border-neutral-800 bg-black p-6">
          <h2 className="font-lexend font-semibold text-[16px] text-neutral-50">
            Profil fotoğrafı
          </h2>
          <p className="font-lexend text-[13px] text-neutral-400 mt-1">
            PNG, JPEG, WebP veya GIF · en fazla 2 MB
          </p>

          <div className="mt-5 flex items-center gap-5">
            <div className="size-20 shrink-0 rounded-full overflow-hidden border border-neutral-800 bg-neutral-900 flex items-center justify-center">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="size-full object-cover" />
              ) : (
                <UserIcon size={28} className="text-neutral-500" />
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInput}
                type="file"
                accept={ACCEPTED}
                onChange={(event) => void handlePick(event)}
                className="hidden"
              />
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInput.current?.click()}
                className={cn(
                  "h-9 px-3 rounded-lg inline-flex items-center gap-2",
                  "font-lexend text-[13px] bg-neutral-50 text-neutral-950",
                  "hover:bg-white transition-colors disabled:opacity-50",
                )}
              >
                <Camera size={16} />
                {uploading ? "Yükleniyor..." : "Görsel seç"}
              </button>

              {user.avatarUrl && (
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => void handleRemoveAvatar()}
                  className={cn(
                    "h-9 px-3 rounded-lg inline-flex items-center gap-2",
                    "font-lexend text-[13px] text-red-400 border border-red-500/30",
                    "hover:bg-red-500/10 transition-colors disabled:opacity-50",
                  )}
                >
                  <TrashCan size={16} /> Kaldır
                </button>
              )}
            </div>
          </div>
        </section>

        {/* --- Hesap bilgileri --- */}
        <form
          onSubmit={(event) => void handleSave(event)}
          className="mt-4 rounded-2xl border border-neutral-800 bg-black p-6"
        >
          <h2 className="font-lexend font-semibold text-[16px] text-neutral-50">
            Hesap bilgileri
          </h2>

          <div className="mt-5 flex flex-col gap-4">
            <Field label="Görünen ad">
              <TextInput
                value={displayName}
                maxLength={64}
                onChange={(event) => setDisplayName(event.target.value)}
                required
              />
            </Field>

            <label className="block">
              <span className="block font-lexend text-[13px] text-neutral-300 mb-1.5">
                Hakkında
              </span>
              <textarea
                value={bio}
                maxLength={500}
                rows={3}
                onChange={(event) => setBio(event.target.value)}
                placeholder="Hangi oyunları oynuyorsun?"
                className={cn(
                  "w-full rounded-lg bg-neutral-950 border border-neutral-800 px-3 py-2",
                  "font-lexend text-[14px] text-neutral-50 placeholder:text-neutral-600",
                  "outline-none focus:border-neutral-600 transition-colors resize-y",
                )}
              />
              <span className="block font-lexend text-[12px] text-neutral-500 mt-1">
                {bio.length}/500
              </span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Bölge">
                <SelectInput
                  value={region}
                  onChange={(event) => setRegion(event.target.value)}
                >
                  <option value="">Seçilmedi</option>
                  {withCurrent(REGIONS, region).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Dil">
                <SelectInput
                  value={language}
                  onChange={(event) => setLanguage(event.target.value)}
                >
                  <option value="">Seçilmedi</option>
                  {withCurrent(LANGUAGES, language).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </SelectInput>
              </Field>
            </div>

            {/* Kullanici adi ve e-posta kimlik anahtari; degistirilmeleri ayri
                bir dogrulama akisi gerektirir, burada yalnizca gosterilir. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-neutral-800">
              <ReadOnlyRow label="Kullanıcı adı" value={user.username} />
              <ReadOnlyRow label="E-posta" value={user.email} />
            </div>

            {error && <FormAlert tone="error">{error}</FormAlert>}
            {saved && !error && <FormAlert tone="success">Profilin güncellendi.</FormAlert>}

            <div className="pt-1">
              <SubmitButton loading={saving}>Kaydet</SubmitButton>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="block font-lexend text-[13px] text-neutral-300 mb-1.5">{label}</span>
      <div className="h-10 rounded-lg bg-neutral-950/60 border border-neutral-900 px-3 flex items-center font-lexend text-[14px] text-neutral-500">
        {value}
      </div>
    </div>
  );
}

export default ProfilePage;
