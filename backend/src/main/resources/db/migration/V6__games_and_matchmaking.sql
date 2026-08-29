-- ---------------------------------------------------------------------------
-- Oyunlar, rank kademeleri ve Quick Match eslestirme kuyrugu
-- ---------------------------------------------------------------------------

CREATE TABLE games (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    slug           VARCHAR(48) NOT NULL UNIQUE,
    name           VARCHAR(64) NOT NULL,
    icon_url       TEXT,
    min_team_size  INTEGER     NOT NULL DEFAULT 2,
    max_team_size  INTEGER     NOT NULL DEFAULT 5,
    has_ranks      BOOLEAN     NOT NULL DEFAULT TRUE,
    is_active      BOOLEAN     NOT NULL DEFAULT TRUE,
    CONSTRAINT games_team_size_check CHECK (min_team_size >= 2 AND max_team_size >= min_team_size)
);

-- tier_order kiyaslanabilir bir sayi verir: "Altin II" ile "Platin I" arasindaki
-- mesafe bu sayilarin farkidir.
CREATE TABLE game_ranks (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id    UUID        NOT NULL REFERENCES games (id) ON DELETE CASCADE,
    name       VARCHAR(48) NOT NULL,
    tier_order INTEGER     NOT NULL,
    icon_url   TEXT,
    CONSTRAINT game_ranks_order_unique UNIQUE (game_id, tier_order)
);
CREATE INDEX game_ranks_game_idx ON game_ranks (game_id, tier_order);

CREATE TABLE user_game_profiles (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    game_id      UUID        NOT NULL REFERENCES games (id) ON DELETE CASCADE,
    in_game_name VARCHAR(64),
    rank_id      UUID        REFERENCES game_ranks (id) ON DELETE SET NULL,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT user_game_profiles_unique UNIQUE (user_id, game_id)
);

CREATE TABLE matches (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id    UUID        NOT NULL REFERENCES games (id),
    party_size INTEGER     NOT NULL,
    region     VARCHAR(16),
    language   VARCHAR(8),
    status     VARCHAR(16) NOT NULL DEFAULT 'FORMING',
    -- Eslesme kuruldugunda acilan gecici oda.
    room_id    UUID        REFERENCES rooms (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at  TIMESTAMPTZ,
    CONSTRAINT matches_status_check CHECK (status IN ('FORMING', 'ACTIVE', 'CLOSED'))
);

CREATE TABLE match_participants (
    id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id  UUID        NOT NULL REFERENCES matches (id) ON DELETE CASCADE,
    user_id   UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    left_at   TIMESTAMPTZ,
    CONSTRAINT match_participants_unique UNIQUE (match_id, user_id)
);

CREATE TABLE matchmaking_tickets (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    game_id        UUID        NOT NULL REFERENCES games (id) ON DELETE CASCADE,
    party_size     INTEGER     NOT NULL,
    rank_id        UUID        REFERENCES game_ranks (id) ON DELETE SET NULL,
    -- Kac kademe fark kabul edilir. Bekleme suresiyle birlikte genisler.
    rank_tolerance INTEGER     NOT NULL DEFAULT 1,
    region         VARCHAR(16),
    language       VARCHAR(8),
    status         VARCHAR(16) NOT NULL DEFAULT 'QUEUED',
    match_id       UUID        REFERENCES matches (id) ON DELETE SET NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at     TIMESTAMPTZ NOT NULL,
    CONSTRAINT tickets_status_check
        CHECK (status IN ('QUEUED', 'MATCHED', 'CANCELLED', 'EXPIRED')),
    CONSTRAINT tickets_party_size_check CHECK (party_size BETWEEN 2 AND 10)
);

-- Eslestirici bu indeksi kullanir: ayni kova (oyun, boyut, bolge, dil) icindeki
-- bekleyen biletleri eskiden yeniye tarar.
CREATE INDEX tickets_queue_idx
    ON matchmaking_tickets (game_id, status, party_size, region, language, created_at);

-- Bir kullanicinin ayni anda yalnizca tek aktif bileti olabilir. Kismi benzersiz
-- indeks, iptal/eslesmis biletleri kapsam disi birakir.
CREATE UNIQUE INDEX tickets_one_active_per_user
    ON matchmaking_tickets (user_id) WHERE status = 'QUEUED';
