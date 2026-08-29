-- ---------------------------------------------------------------------------
-- Arkadaslik ve direkt mesajlar
-- ---------------------------------------------------------------------------

CREATE TABLE friendships (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    addressee_id UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    status       VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    responded_at TIMESTAMPTZ,
    CONSTRAINT friendships_pair_unique UNIQUE (requester_id, addressee_id),
    CONSTRAINT friendships_not_self CHECK (requester_id <> addressee_id),
    CONSTRAINT friendships_status_check CHECK (status IN ('PENDING', 'ACCEPTED', 'BLOCKED'))
);
CREATE INDEX friendships_addressee_idx ON friendships (addressee_id, status);
CREATE INDEX friendships_requester_idx ON friendships (requester_id, status);

-- Ikili sohbet. Kullanici ciftini siralayarak saklamak (a < b) ayni ikili icin
-- iki ayri konusma olusmasini veritabani seviyesinde imkansiz kilar.
CREATE TABLE dm_conversations (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_a_id  UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    user_b_id  UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT dm_conversations_ordered CHECK (user_a_id < user_b_id),
    CONSTRAINT dm_conversations_unique UNIQUE (user_a_id, user_b_id)
);
CREATE INDEX dm_conversations_user_a_idx ON dm_conversations (user_a_id);
CREATE INDEX dm_conversations_user_b_idx ON dm_conversations (user_b_id);

-- ---------------------------------------------------------------------------
-- messages tablosu artik hem kanal hem DM mesajlarini tasiyor.
-- V3'te yalnizca kanal vardi; dm_conversations simdi olustugu icin kolon ve
-- kisit burada ekleniyor.
-- ---------------------------------------------------------------------------

ALTER TABLE messages ALTER COLUMN channel_id DROP NOT NULL;

ALTER TABLE messages ADD COLUMN conversation_id UUID
    REFERENCES dm_conversations (id) ON DELETE CASCADE;

-- Tam olarak biri dolu olmali: mesaj ya bir kanala ya bir sohbete aittir.
ALTER TABLE messages ADD CONSTRAINT messages_target_check
    CHECK ((channel_id IS NULL) <> (conversation_id IS NULL));

CREATE INDEX messages_conversation_created_idx
    ON messages (conversation_id, created_at DESC, id DESC);
