-- Hesap devre disi birakma (moderasyon).
--
-- Silmek yerine isaretlemek tercih edildi: kullanicinin mesajlari, oda
-- uyelikleri ve maclari kayitlarda kalir, yalnizca giris engellenir.
ALTER TABLE users ADD COLUMN disabled_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN disabled_reason VARCHAR(200);

CREATE INDEX users_disabled_idx ON users (disabled_at) WHERE disabled_at IS NOT NULL;
