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

export function RegisterPage() {
  const [form, setForm] = useState({
    username: "",
    displayName: "",
    email: "",
    password: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setLoading(true);

    try {
      await authApi.register(form);
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        // Sunucu alan bazlı hata döndüyse ilgili girdinin altında göster.
        setFieldErrors(err.fieldErrors);
      } else {
        setError("Sunucuya ulaşılamadı.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <AuthLayout
        title="E-postanı kontrol et"
        subtitle={`${form.email} adresine bir doğrulama bağlantısı gönderdik. Giriş yapabilmek için bağlantıya tıkla.`}
        footer={
          <Link to="/login" className="text-neutral-50 hover:underline">
            Girişe dön
          </Link>
        }
      >
        <FormAlert tone="success">
          Bağlantı 24 saat geçerli. Mail gelmediyse spam klasörünü kontrol et.
        </FormAlert>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Hesap oluştur"
      subtitle="Takım arkadaşı bulmaya başla."
      footer={
        <>
          Zaten hesabın var mı?{" "}
          <Link to="/login" className="text-neutral-50 hover:underline">
            Giriş yap
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && <FormAlert tone="error">{error}</FormAlert>}

        <Field label="Kullanıcı adı" error={fieldErrors.username}>
          <TextInput
            value={form.username}
            onChange={update("username")}
            placeholder="teoman"
            autoComplete="username"
            required
          />
        </Field>

        <Field label="Görünen ad" error={fieldErrors.displayName}>
          <TextInput
            value={form.displayName}
            onChange={update("displayName")}
            placeholder="Teoman"
            required
          />
        </Field>

        <Field label="E-posta" error={fieldErrors.email}>
          <TextInput
            type="email"
            value={form.email}
            onChange={update("email")}
            placeholder="ornek@eposta.com"
            autoComplete="email"
            required
          />
        </Field>

        <Field label="Şifre" error={fieldErrors.password}>
          <TextInput
            type="password"
            value={form.password}
            onChange={update("password")}
            placeholder="En az 8 karakter"
            autoComplete="new-password"
            required
          />
        </Field>

        <SubmitButton loading={loading}>Kayıt ol</SubmitButton>
      </form>
    </AuthLayout>
  );
}

export default RegisterPage;
