-- Yeni cihazdan girişte e-posta ile kod doğrulaması.
--
-- Tanınan cihazlar bir çerezdeki rastgele token ile hatırlanır; token'ın
-- yalnızca SHA-256 özeti saklanır, böylece veritabanı sızsa bile eldeki
-- kayıtlarla bir cihaz taklit edilemez.

CREATE TABLE login_challenges (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    -- Kodun kendisi değil özeti; e-postadaki 6 haneli değer geri üretilemez.
    code_hash   VARCHAR(64) NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    -- Kaba kuvvet denemesini sınırlamak için: 6 hane yalnızca 1e6 olasılık.
    attempts    INT         NOT NULL DEFAULT 0,
    user_agent  VARCHAR(512),
    ip          VARCHAR(64),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_login_challenges_user ON login_challenges (user_id, created_at DESC);

CREATE TABLE trusted_devices (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash   VARCHAR(64) NOT NULL UNIQUE,
    -- Kullanıcının cihazı tanıyabilmesi için tarayıcı/işletim sistemi özeti.
    label        VARCHAR(255),
    expires_at   TIMESTAMPTZ NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ
);

CREATE INDEX idx_trusted_devices_user ON trusted_devices (user_id);
