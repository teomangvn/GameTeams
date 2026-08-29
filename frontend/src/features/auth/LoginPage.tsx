import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { authApi } from "@/api/auth";
import { ApiError } from "@/api/client";
import { useAuthStore } from "@/stores/authStore";
import {
  AuthLayout,
  Field,
  FormAlert,
  SubmitButton,
  TextInput,
} from "@/features/auth/AuthLayout";

export function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Doğrulanmamış hesapta "tekrar gönder" bağlantısı gösterilir.
  const [needsVerification, setNeedsVerification] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setNeedsVerification(false);
    setLoading(true);

    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setNeedsVerification(err.code === "EMAIL_NOT_VERIFIED");
      } else {
        setError("Sunucuya ulaşılamadı.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      const result = await authApi.resendVerification(email);
      setError(null);
      setNotice(result.message);
      setNeedsVerification(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gönderilemedi.");
    }
  };

  return (
    <AuthLayout
      title="Tekrar hoş geldin"
      subtitle="Takımına dönmek için giriş yap."
      footer={
        <>
          Hesabın yok mu?{" "}
          <Link to="/register" className="text-neutral-50 hover:underline">
            Kayıt ol
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <FormAlert tone="error">
            {error}
            {needsVerification && (
              <>
                {" "}
                <button
                  type="button"
                  onClick={handleResend}
                  className="underline font-semibold"
                >
                  Doğrulama mailini tekrar gönder
                </button>
              </>
            )}
          </FormAlert>
        )}
        {notice && <FormAlert tone="success">{notice}</FormAlert>}

        <Field label="E-posta">
          <TextInput
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ornek@eposta.com"
            autoComplete="email"
            required
          />
        </Field>

        <Field label="Şifre">
          <TextInput
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
        </Field>

        <div className="flex justify-end -mt-1">
          <Link
            to="/forgot-password"
            className="font-lexend text-[13px] text-neutral-400 hover:text-neutral-200"
          >
            Şifremi unuttum
          </Link>
        </div>

        <SubmitButton loading={loading}>Giriş yap</SubmitButton>
      </form>
    </AuthLayout>
  );
}

export default LoginPage;
