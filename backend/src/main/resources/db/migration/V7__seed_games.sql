-- Baslangic oyun listesi ve rank kademeleri.
-- tier_order dusukten yuksege dogru artar; eslestirici bu sayilarin farkina bakar.

INSERT INTO games (slug, name, min_team_size, max_team_size, has_ranks) VALUES
    ('valorant',      'Valorant',           2, 5, TRUE),
    ('lol',           'League of Legends',  2, 5, TRUE),
    ('cs2',           'CS2',                2, 5, TRUE),
    ('dota2',         'Dota 2',             2, 5, TRUE),
    ('rocket-league', 'Rocket League',      2, 3, TRUE),
    ('apex',          'Apex Legends',       2, 3, TRUE);

INSERT INTO game_ranks (game_id, name, tier_order)
SELECT g.id, r.name, r.tier_order
FROM games g
JOIN (VALUES
    ('Demir', 1), ('Bronz', 2), ('Gumus', 3), ('Altin', 4), ('Platin', 5),
    ('Elmas', 6), ('Yukselen', 7), ('Olumsuz', 8), ('Radiant', 9)
) AS r(name, tier_order) ON TRUE
WHERE g.slug = 'valorant';

INSERT INTO game_ranks (game_id, name, tier_order)
SELECT g.id, r.name, r.tier_order
FROM games g
JOIN (VALUES
    ('Demir', 1), ('Bronz', 2), ('Gumus', 3), ('Altin', 4), ('Platin', 5),
    ('Zumrut', 6), ('Elmas', 7), ('Usta', 8), ('Buyuk Usta', 9), ('Sampiyon', 10)
) AS r(name, tier_order) ON TRUE
WHERE g.slug = 'lol';

INSERT INTO game_ranks (game_id, name, tier_order)
SELECT g.id, r.name, r.tier_order
FROM games g
JOIN (VALUES
    ('Gumus', 1), ('Altin Nova', 2), ('Master Guardian', 3), ('Kartal', 4),
    ('Supreme', 5), ('Global Elite', 6)
) AS r(name, tier_order) ON TRUE
WHERE g.slug = 'cs2';

INSERT INTO game_ranks (game_id, name, tier_order)
SELECT g.id, r.name, r.tier_order
FROM games g
JOIN (VALUES
    ('Herald', 1), ('Guardian', 2), ('Crusader', 3), ('Archon', 4),
    ('Legend', 5), ('Ancient', 6), ('Divine', 7), ('Immortal', 8)
) AS r(name, tier_order) ON TRUE
WHERE g.slug = 'dota2';

INSERT INTO game_ranks (game_id, name, tier_order)
SELECT g.id, r.name, r.tier_order
FROM games g
JOIN (VALUES
    ('Bronz', 1), ('Gumus', 2), ('Altin', 3), ('Platin', 4), ('Elmas', 5),
    ('Sampiyon', 6), ('Grand Champion', 7)
) AS r(name, tier_order) ON TRUE
WHERE g.slug = 'rocket-league';

INSERT INTO game_ranks (game_id, name, tier_order)
SELECT g.id, r.name, r.tier_order
FROM games g
JOIN (VALUES
    ('Bronz', 1), ('Gumus', 2), ('Altin', 3), ('Platin', 4), ('Elmas', 5),
    ('Usta', 6), ('Apex Predator', 7)
) AS r(name, tier_order) ON TRUE
WHERE g.slug = 'apex';
