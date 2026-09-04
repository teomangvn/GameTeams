import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { ApiError } from "@/api/client";
import { usersApi } from "@/api/users";
import { AuthLayout, FormAlert } from "@/features/auth/AuthLayout";

/**
 * E-posta değişikliği onay sayfası.
 *
 * Bağlantıya çoğu zaman oturum açık olmayan bir tarayıcıdan tıklanır, bu yüzden
 * kimlik istemez; token'ın kendisi kanıttır.
 */
export function ConfirmEmailChangePage() {
  const [params] = useSearchParams();
  const token = params.get("token");

  const [state, setState] = useState<"pending" | "done" | "error">("pending");
  const [message, setMessage] = useState("");
  // Token tek kullanimlik: React 18 strict mode'da efektin iki kez calismasi
  // ikinci istegi "gecersiz token" ile dondururdu.
  const attempted = useRef(false);

  useEffect(() => {
    if (!token) {
      setState("error");
      setMessage("Bağlantı eksik veya bozuk.");
      return;
    }
    if (attempted.current) return;
    attempted.current = true;

    void (async () => {
      try {
        const result = await usersApi.confirmEmailChange(token);
        setState("done");
        setMessage(result.message);
      } catch (error) {
        setState("error");
        setMessage(error instanceof ApiError ? error.message : "Doğrulama başarısız.");
      }
    })();
  }, [token]);

  return (
    <AuthLayout
      title="E-posta doğrulama"
      subtitle={state === "pending" ? "Bağlantı kontrol ediliyor..." : undefined}
      footer={
        <Link to="/" className="text-neutral-50 hover:underline">
          Uygulamaya dön
        </Link>
      }
    >
      {state === "done" && <FormAlert tone="success">{message}</FormAlert>}
      {state === "error" && <FormAlert tone="error">{message}</FormAlert>}
      {state === "pending" && (
        <p className="font-lexend text-[14px] text-neutral-400">Lütfen bekle...</p>
      )}
    </AuthLayout>
  );
}

export default ConfirmEmailChangePage;
