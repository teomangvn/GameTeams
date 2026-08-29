import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { authApi } from "@/api/auth";
import { ApiError } from "@/api/client";
import { AuthLayout, FormAlert } from "@/features/auth/AuthLayout";

type Status = "verifying" | "success" | "error";

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token");

  const [status, setStatus] = useState<Status>("verifying");
  const [message, setMessage] = useState("");
  // StrictMode geliştirmede efektleri iki kez çalıştırır; token tek
  // kullanımlık olduğu için ikinci çağrı "geçersiz token" hatası verirdi.
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    if (!token) {
      setStatus("error");
      setMessage("Bağlantıda doğrulama kodu yok.");
      return;
    }

    authApi
      .verifyEmail(token)
      .then((result) => {
        setStatus("success");
        setMessage(result.message);
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err instanceof ApiError ? err.message : "Doğrulama başarısız.");
      });
  }, [token]);

  return (
    <AuthLayout
      title="E-posta doğrulama"
      footer={
        <Link to="/login" className="text-neutral-50 hover:underline">
          Girişe dön
        </Link>
      }
    >
      {status === "verifying" && (
        <p className="font-lexend text-[14px] text-neutral-400">Doğrulanıyor...</p>
      )}
      {status === "success" && <FormAlert tone="success">{message}</FormAlert>}
      {status === "error" && <FormAlert tone="error">{message}</FormAlert>}
    </AuthLayout>
  );
}

export default VerifyEmailPage;
