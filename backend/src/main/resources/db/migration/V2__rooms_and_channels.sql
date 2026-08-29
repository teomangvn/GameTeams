-- ---------------------------------------------------------------------------
-- Odalar (Discord'daki "sunucu") ve kanallar
-- ---------------------------------------------------------------------------

CREATE TABLE rooms (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name         VARCHAR(64)  NOT NULL,
    slug         VARCHAR(80)  NOT NULL UNIQUE,
    description  VARCHAR(300),
    icon_url     TEXT,
    owner_id     UUID         NOT NULL REFERENCES users (id),
    is_public    BOOLEAN      NOT NULL DEFAULT FALSE,
    -- Davet kodu tahmin edilemez olmalı; paylaşılan tek erişim anahtarı.
    invite_code  VARCHAR(32)  NOT NULL UNIQUE,
    -- Quick Match eşleşmelerinde açılan geçici odalar bu bayrakla işaretlenir
    -- ve boş kaldıklarında temizlik işi tarafından silinir.
    is_temporary BOOLEAN      NOT NULL DEFAULT FALSE,
    max_members  INTEGER      NOT NULL DEFAULT 100,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT rooms_max_members_check CHECK (max_members BETWEEN 2 AND 500)
);
CREATE INDEX rooms_owner_idx     ON rooms (owner_id);
CREATE INDEX rooms_temporary_idx ON rooms (is_temporary) WHERE is_temporary;

CREATE TABLE room_members (
    id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id   UUID        NOT NULL REFERENCES rooms (id) ON DELETE CASCADE,
    user_id   UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role      VARCHAR(16) NOT NULL DEFAULT 'MEMBER',
    nickname  VARCHAR(64),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT room_members_unique UNIQUE (room_id, user_id),
    CONSTRAINT room_members_role_check CHECK (role IN ('OWNER', 'MEMBER'))
);
CREATE INDEX room_members_user_idx ON room_members (user_id);

CREATE TABLE channels (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id    UUID        NOT NULL REFERENCES rooms (id) ON DELETE CASCADE,
    name       VARCHAR(64) NOT NULL,
    type       VARCHAR(16) NOT NULL,
    topic      VARCHAR(300),
    position   INTEGER     NOT NULL DEFAULT 0,
    -- Yalnızca ses kanalları için anlamlı. Mesh WebRTC 8 kişiden sonra
    -- pratik olmadığından üst sınır burada zorlanır.
    user_limit INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT channels_name_unique UNIQUE (room_id, name),
    CONSTRAINT channels_type_check  CHECK (type IN ('TEXT', 'VOICE')),
    CONSTRAINT channels_user_limit_check CHECK (user_limit IS NULL OR user_limit BETWEEN 2 AND 8)
);
CREATE INDEX channels_room_idx ON channels (room_id, position);
