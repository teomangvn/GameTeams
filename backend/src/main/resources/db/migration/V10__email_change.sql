-- E-posta adresi değiştirme.
--
-- Adres hemen değişmez: yeni adrese doğrulama bağlantısı gider ve ancak
-- tıklandığında geçerli olur. Aksi halde yanlış yazılan bir adres hesabı
-- erişilemez hale getirirdi -- şifre sıfırlama da o adrese gideceği için.

CREATE TABLE email_change_tokens (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    -- Doğrulanana kadar users.email'e yazılmaz.
    new_email  VARCHAR(255) NOT NULL,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_change_tokens_user ON email_change_tokens (user_id, created_at DESC);
