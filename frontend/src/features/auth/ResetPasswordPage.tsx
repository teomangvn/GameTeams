import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { authApi } from "@/api/auth";
import { ApiError } from "@/api/client";
import {
  AuthLayout,
  Field,
  FormAlert,
  SubmitButton,
  TextInput,
} from "@/features/auth/AuthLayout";

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    if (password !== confirm) {
      setFieldErrors({ confirm: "Şifreler eşleşmiyor." });
      return;
    }
    if (!token) {
      setError("Bağlantıda sıfırlama kodu yok.");
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword(token, password);
      navigate("/login", { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fieldErrors);
      } else {
        setError("Sunucuya ulaşılamadı.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Yeni şifre belirle"
      subtitle="Şifreni değiştirdiğinde açık olan tüm oturumların kapatılır."
      footer={
        <Link to="/login" className="text-neutral-50 hover:underline">
          Girişe dön
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && <FormAlert tone="error">{error}</FormAlert>}

        <Field label="Yeni şifre" error={fieldErrors.newPassword}>
          <TextInput
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="En az 8 karakter"
            autoComplete="new-password"
            required
          />
        </Field>

        <Field label="Yeni şifre (tekrar)" error={fieldErrors.confirm}>
          <TextInput
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
            required
          />
        </Field>

        <SubmitButton loading={loading}>Şifremi güncelle</SubmitButton>
      </form>
    </AuthLayout>
  );
}

export default ResetPasswordPage;
