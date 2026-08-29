-- ---------------------------------------------------------------------------
-- Mesajlar
--
-- Kanal mesajlari ve DM'ler ayni tabloda tutulur: tek servis ve tek WebSocket
-- yayin hatti her ikisine hizmet eder. conversation_id kolonu ile CHECK
-- kisiti, dm_conversations tablosunun olustugu V4'te eklenir.
-- ---------------------------------------------------------------------------

CREATE TABLE messages (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id  UUID        NOT NULL REFERENCES channels (id) ON DELETE CASCADE,
    author_id   UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    content     TEXT        NOT NULL,
    reply_to_id UUID        REFERENCES messages (id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    edited_at   TIMESTAMPTZ,
    deleted_at  TIMESTAMPTZ,
    CONSTRAINT messages_content_length CHECK (char_length(content) BETWEEN 1 AND 4000)
);

-- Keyset pagination: (created_at DESC, id DESC) ile sayfalanir. id ikincil
-- anahtar olarak gerekli, ayni mikrosaniyede yazilan mesajlar atlanmasin diye.
CREATE INDEX messages_channel_created_idx ON messages (channel_id, created_at DESC, id DESC);
CREATE INDEX messages_author_idx          ON messages (author_id);
