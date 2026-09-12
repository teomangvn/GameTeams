import { useEffect, useState } from "react";

import { authApi, type OAuthProvider } from "@/api/auth";
import { cn } from "@/lib/utils";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

const PROVIDERS: Record<OAuthProvider, { label: string; icon: React.ReactNode; className: string }> = {
  google: {
    label: "Google ile devam et",
    icon: <GoogleIcon />,
    className: "bg-white text-neutral-900 hover:bg-neutral-100 border-neutral-200",
  },
  facebook: {
    label: "Facebook ile devam et",
    icon: <FacebookIcon />,
    className: "bg-[#1877F2] text-white hover:bg-[#166FE5] border-[#1877F2]",
  },
};

/**
 * Harici giris butonlari. Yalnizca sunucuda kimlik bilgisi tanimli olan
 * saglayicilar gosterilir; hicbiri yoksa bilesen hic yer kaplamaz.
 *
 * Butonlar duz baglanti: akis tarayicinin saglayiciya gidip donmesini
 * gerektiriyor, fetch ile yapilamaz.
 */
export function OAuthButtons({ disabled = false }: { disabled?: boolean }) {
  const [providers, setProviders] = useState<OAuthProvider[]>([]);
  const [pending, setPending] = useState<OAuthProvider | null>(null);

  useEffect(() => {
    let cancelled = false;
    authApi
      .oauthProviders()
      .then(({ providers: available }) => {
        if (!cancelled) {
          setProviders(available.filter((id): id is OAuthProvider => id in PROVIDERS));
        }
      })
      // Uc yoksa veya sunucu kapaliysa butonlar gosterilmez; sifreli giris calismaya devam eder.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // Saglayici ekranindan geri tusuyla donulurse sayfa onbellekten gelir ve
  // buton "Yonlendiriliyor" durumunda takili kalirdi.
  useEffect(() => {
    const reset = (event: PageTransitionEvent) => {
      if (event.persisted) setPending(null);
    };
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  if (providers.length === 0) return null;

  return (
    <div className="flex flex-col gap-2.5">
      {providers.map((id) => {
        const provider = PROVIDERS[id];
        return (
          <a
            key={id}
            href={`${API_BASE}/api/auth/oauth2/authorization/${id}`}
            onClick={(event) => {
              // Cift tiklama iki ayri akis baslatip state uyusmazligina yol aciyordu.
              if (pending || disabled) event.preventDefault();
              else setPending(id);
            }}
            aria-disabled={disabled || pending !== null}
            className={cn(
              "w-full h-10 rounded-lg border inline-flex items-center justify-center gap-2.5",
              "font-lexend font-medium text-[14px] transition-colors",
              provider.className,
              (disabled || (pending && pending !== id)) && "opacity-50 pointer-events-none",
            )}
          >
            {provider.icon}
            {pending === id ? "Yönlendiriliyor..." : provider.label}
          </a>
        );
      })}

      <div className="flex items-center gap-3 my-1.5" aria-hidden="true">
        <span className="h-px flex-1 bg-neutral-800" />
        <span className="font-lexend text-[12px] text-neutral-500">veya e-postayla</span>
        <span className="h-px flex-1 bg-neutral-800" />
      </div>
    </div>
  );
}

/** Giris ekranina donen hata kodlarinin kullaniciya gosterilen karsiligi. */
export function describeOAuthError(code: string | null): string | null {
  switch (code) {
    case null:
      return null;
    case "CANCELLED":
      return "Giriş iptal edildi.";
    case "EMAIL_REQUIRED":
      return "Hesabından e-posta adresi alınamadı. E-posta iznini vererek tekrar dene veya e-postayla kayıt ol.";
    case "ACCOUNT_EXISTS":
      return "Bu e-postayla zaten bir hesabın var. Şifrenle giriş yap; şifreni hatırlamıyorsan “Şifremi unuttum”u kullan.";
    case "ACCOUNT_DISABLED":
      return "Hesabın devre dışı bırakıldı.";
    default:
      return "Giriş tamamlanamadı. Tekrar dene.";
  }
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-[18px]" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" aria-hidden="true" fill="currentColor">
      <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z" />
    </svg>
  );
}

export default OAuthButtons;
