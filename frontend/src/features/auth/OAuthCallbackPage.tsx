import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

import { AuthLayout, FormAlert } from "@/features/auth/AuthLayout";
import { useAuthStore } from "@/stores/authStore";

/**
 * Google / Facebook donusu.
 *
 * Sunucu refresh cerezini yazip buraya yonlendirir. Oturumu uygulama acilisindaki
 * restore() zaten o cerezle kurar; bu sayfa yalnizca onun bitmesini bekler.
 * Burada ayrica refresh cagirmak ayni token'i ikinci kez kullanirdi ve sunucu
 * bunu token hirsizligi sayip butun oturumlari kapatirdi.
 */
export function OAuthCallbackPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);

  useEffect(() => {
    if (initialized && user) navigate("/", { replace: true });
  }, [initialized, user, navigate]);

  if (!initialized || user) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <span className="font-lexend text-[14px] text-neutral-500">Giriş tamamlanıyor...</span>
      </div>
    );
  }

  return (
    <AuthLayout
      title="Giriş tamamlanamadı"
      footer={
        <Link to="/login" className="text-neutral-50 hover:underline">
          Girişe dön
        </Link>
      }
    >
      <FormAlert tone="error">
        Oturum açılamadı. Tarayıcın çerezleri engelliyor olabilir; tekrar dene.
      </FormAlert>
    </AuthLayout>
  );
}

export default OAuthCallbackPage;
