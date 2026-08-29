import { useState } from "react";
import { Link } from "react-router-dom";

import { authApi } from "@/api/auth";
import { ApiError } from "@/api/client";
import {
  AuthLayout,
  Field,
  FormAlert,
  SubmitButton,
  TextInput,
} from "@/features/auth/AuthLayout";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    try {
      const result = await authApi.forgotPassword(email);
      setNotice(result.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sunucuya ulaşılamadı.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Şifreni sıfırla"
      subtitle="Kayıtlı e-posta adresini gir, sıfırlama bağlantısı gönderelim."
      footer={
        <Link to="/login" className="text-neutral-50 hover:underline">
          Girişe dön
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && <FormAlert tone="error">{error}</FormAlert>}
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

        <SubmitButton loading={loading}>Sıfırlama bağlantısı gönder</SubmitButton>
      </form>
    </AuthLayout>
  );
}

export default ForgotPasswordPage;
