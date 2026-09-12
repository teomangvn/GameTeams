-- Google / Facebook ile giris.
--
-- Harici hesapla acilan kullanicinin sifresi yoktur. Sahte bir hash yazmak
-- yerine alan bos birakilir: "sifresi var mi" sorusu boylece acikca
-- sorulabilir ve rastgele bir hash'in bir gun eslesmesi ihtimali hic dogmaz.
-- Kullanici isterse "sifremi unuttum" akisiyla sifre belirleyebilir.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Bir kullaniciya bagli harici hesaplar. Eslesme e-postaya degil saglayicinin
-- degismez kimligine (sub / id) gore yapilir: kullanici saglayicidaki
-- e-postasini degistirse de ayni hesaba girer.
CREATE TABLE user_identities (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    provider      VARCHAR(32)  NOT NULL,
    subject       VARCHAR(255) NOT NULL,
    -- Baglanirken saglayicinin bildirdigi adres; yalnizca bilgi amacli.
    email         VARCHAR(255),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    last_login_at TIMESTAMPTZ,
    CONSTRAINT user_identities_provider_subject_key UNIQUE (provider, subject)
);
CREATE INDEX user_identities_user_idx ON user_identities (user_id);
