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
  const verifyDevice = useAuthStore((s) => s.verifyDevice);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Doğrulanmamış hesapta "tekrar gönder" bağlantısı gösterilir.
  const [needsVerification, setNeedsVerification] = useState(false);
  /** Taninmayan cihaz: kod adimina gecilir, sifre tekrar sorulmaz. */
  const [challenge, setChallenge] = useState<{
    challengeId: string;
    maskedEmail: string;
  } | null>(null);
  const [code, setCode] = useState("");
  const [rememberDevice, setRememberDevice] = useState(true);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setNeedsVerification(false);
    setLoading(true);

    try {
      const pending = await login(email, password);
      if (pending) {
        setChallenge(pending);
        return;
      }
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

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!challenge) return;

    setError(null);
    setLoading(true);
    try {
      await verifyDevice(challenge.challengeId, code, rememberDevice);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sunucuya ulaşılamadı.");
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

  if (challenge) {
    return (
      <AuthLayout
        title="Yeni cihaz doğrulaması"
        subtitle={`${challenge.maskedEmail} adresine 6 haneli bir kod gönderdik. Kod 10 dakika geçerli.`}
        footer={
          <button
            type="button"
            onClick={() => {
              setChallenge(null);
              setCode("");
              setError(null);
            }}
            className="text-neutral-50 hover:underline"
          >
            Giriş ekranına dön
          </button>
        }
      >
        <form onSubmit={(event) => void handleVerify(event)} className="flex flex-col gap-4">
          {error && <FormAlert tone="error">{error}</FormAlert>}

          <Field label="Doğrulama kodu">
            <TextInput
              autoFocus
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/[^0-9]/g, ""))}
              placeholder="000000"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              className="text-center tracking-[0.4em] text-[18px]"
            />
          </Field>

          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={rememberDevice}
              onChange={(event) => setRememberDevice(event.target.checked)}
              className="mt-0.5 size-4 accent-neutral-50"
            />
            <span className="font-lexend text-[13px] text-neutral-300 leading-relaxed">
              Bu cihazı hatırla
              <span className="block text-[12px] text-neutral-500">
                90 gün boyunca bu tarayıcıda kod sorulmaz.
              </span>
            </span>
          </label>

          <SubmitButton loading={loading}>Doğrula ve giriş yap</SubmitButton>
        </form>
      </AuthLayout>
    );
  }

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
