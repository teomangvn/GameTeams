-- gen_random_uuid() için
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    username       VARCHAR(32)  NOT NULL,
    display_name   VARCHAR(64)  NOT NULL,
    email          VARCHAR(255) NOT NULL,
    password_hash  VARCHAR(100) NOT NULL,
    avatar_url     TEXT,
    bio            VARCHAR(300),
    role           VARCHAR(16)  NOT NULL DEFAULT 'USER',
    email_verified BOOLEAN      NOT NULL DEFAULT FALSE,
    region         VARCHAR(16),
    language       VARCHAR(8),
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    last_seen_at   TIMESTAMPTZ,
    CONSTRAINT users_role_check CHECK (role IN ('USER', 'ADMIN'))
);

-- Kullanıcı adı ve e-posta büyük/küçük harf duyarsız benzersiz olmalı:
-- "Teoman" ile "teoman" aynı hesaptır.
CREATE UNIQUE INDEX users_username_lower_key ON users (lower(username));
CREATE UNIQUE INDEX users_email_lower_key    ON users (lower(email));

-- ---------------------------------------------------------------------------
-- Token tabloları
--
-- Ham token asla saklanmaz; yalnızca SHA-256 özeti yazılır. Veritabanı sızarsa
-- eldeki özetlerle oturum açılamaz veya şifre sıfırlanamaz.
-- ---------------------------------------------------------------------------

CREATE TABLE email_verification_tokens (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX email_verification_tokens_user_idx ON email_verification_tokens (user_id);

CREATE TABLE password_reset_tokens (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX password_reset_tokens_user_idx ON password_reset_tokens (user_id);

CREATE TABLE refresh_tokens (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    user_agent VARCHAR(255),
    ip         VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX refresh_tokens_user_idx ON refresh_tokens (user_id);
