-- Engelleme arkadasliktan ayri bir iliski.
--
-- Onceden friendships.status = 'BLOCKED' ile tutuluyordu. O satir kimin kimi
-- engelledigini soylemiyordu (requester istegi gonderen kisi, engelleyen
-- degil); bu yuzden engeli kaldirmak ve "engellediklerim" listesi mumkun
-- degildi. Iki taraf birbirini engellediginde de tek satir yetmiyordu.
CREATE TABLE user_blocks (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_id UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    blocked_id UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT user_blocks_pair_unique UNIQUE (blocker_id, blocked_id),
    CONSTRAINT user_blocks_not_self CHECK (blocker_id <> blocked_id)
);
CREATE INDEX user_blocks_blocked_idx ON user_blocks (blocked_id);

-- Arayuzde engelleme hic sunulmadigi icin bu satirlar pratikte yok. Varsa en
-- iyi tahmin istegi baslatan tarafin engelledigidir; iliski de kaldirilir.
INSERT INTO user_blocks (blocker_id, blocked_id, created_at)
SELECT requester_id, addressee_id, coalesce(responded_at, created_at)
FROM friendships
WHERE status = 'BLOCKED'
ON CONFLICT DO NOTHING;

DELETE FROM friendships WHERE status = 'BLOCKED';
