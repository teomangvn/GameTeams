package com.gameteams.matchmaking;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Kuyrugu tarayip takim kuran zamanlanmis is.
 *
 * Postgres advisory lock kullanir: ileride birden fazla uygulama ornegi
 * calissa bile ayni bilet iki farkli maca giremez.
 */
@Component
public class MatchmakerJob {

    private static final Logger log = LoggerFactory.getLogger(MatchmakerJob.class);

    /** Advisory lock icin sabit anahtar; yalnizca bu isle paylasilir. */
    private static final long LOCK_KEY = 815_243_001L;

    private final MatchmakingTicketRepository tickets;
    private final MatchFactory matchFactory;
    private final JdbcTemplate jdbc;

    MatchmakerJob(MatchmakingTicketRepository tickets, MatchFactory matchFactory,
            JdbcTemplate jdbc) {
        this.tickets = tickets;
        this.matchFactory = matchFactory;
        this.jdbc = jdbc;
    }

    @Scheduled(fixedDelay = 2000)
    @Transactional
    public void run() {
        // Kilit alinamazsa baska bir ornek tariyordur; bu tur atlanir.
        Boolean acquired = jdbc.queryForObject("select pg_try_advisory_xact_lock(?)",
                Boolean.class, LOCK_KEY);
        if (!Boolean.TRUE.equals(acquired)) {
            return;
        }

        Instant now = Instant.now();
        List<MatchmakingTicket> queued = tickets.findQueued(now);
        if (queued.isEmpty()) {
            return;
        }

        for (var bucket : groupByCriteria(queued).values()) {
            formMatches(bucket, now);
        }
    }

    /**
     * Ayni oyun, takim boyutu, bolge ve dildeki biletler tek kovaya toplanir.
     * Bu dort kriter kesin eslesmelidir; yalnizca rank toleransla esnetilir.
     */
    private Map<Bucket, List<MatchmakingTicket>> groupByCriteria(List<MatchmakingTicket> queued) {
        Map<Bucket, List<MatchmakingTicket>> buckets = new LinkedHashMap<>();
        for (MatchmakingTicket ticket : queued) {
            buckets.computeIfAbsent(
                    new Bucket(ticket.getGame().getId(), ticket.getPartySize(),
                            ticket.getRegion(), ticket.getLanguage()),
                    key -> new ArrayList<>()).add(ticket);
        }
        return buckets;
    }

    /**
     * Kova icinde acgozlu eslestirme: en uzun bekleyen bilet capa olur, ona
     * uyan biletler toplanir. Capayi en eskiden secmek, kuyrukta bekleme
     * suresinin adil dagilmasini saglar.
     */
    private void formMatches(List<MatchmakingTicket> bucket, Instant now) {
        int partySize = bucket.get(0).getPartySize();
        boolean rankMatters = bucket.get(0).getGame().hasRanks();

        List<MatchmakingTicket> remaining = new ArrayList<>(bucket);

        while (remaining.size() >= partySize) {
            MatchmakingTicket anchor = remaining.get(0);
            List<MatchmakingTicket> party = new ArrayList<>();
            party.add(anchor);

            for (int i = 1; i < remaining.size() && party.size() < partySize; i++) {
                MatchmakingTicket candidate = remaining.get(i);
                if (!rankMatters || isRankCompatible(anchor, candidate, now)) {
                    party.add(candidate);
                }
            }

            if (party.size() < partySize) {
                // Capaya uyan yeterli oyuncu yok. Capayi kuyrukta birakip
                // sonraki turda daha genis toleransla tekrar denenecek.
                remaining.remove(0);
                continue;
            }

            matchFactory.createMatch(anchor.getGame(), partySize, anchor.getRegion(),
                    anchor.getLanguage(), party);
            remaining.removeAll(party);
        }
    }

    /**
     * Iki bilet rank olarak uyumlu mu? Tolerans ikisinden genis olani kazanir:
     * uzun sure bekleyen oyuncu, yeni gelen dar toleransli oyuncuyu de kabul
     * edebilmeli.
     */
    private boolean isRankCompatible(MatchmakingTicket anchor, MatchmakingTicket candidate,
            Instant now) {
        Integer anchorTier = anchor.tierOrder();
        Integer candidateTier = candidate.tierOrder();

        // Rank'i belirtilmemis oyuncular her kademeyle eslesebilir.
        if (anchorTier == null || candidateTier == null) {
            return true;
        }

        int tolerance = Math.max(anchor.effectiveTolerance(now),
                candidate.effectiveTolerance(now));
        return Math.abs(anchorTier - candidateTier) <= tolerance;
    }

    /** Suresi dolan biletleri temizler. */
    @Scheduled(fixedDelay = 60_000)
    @Transactional
    public void expireStaleTickets() {
        List<MatchmakingTicket> expired = tickets.findExpired(Instant.now());
        if (expired.isEmpty()) {
            return;
        }
        expired.forEach(MatchmakingTicket::expire);
        log.debug("{} bilet suresi doldu", expired.size());
    }

    private record Bucket(UUID gameId, int partySize, String region, String language) {

        @Override
        public boolean equals(Object other) {
            return other instanceof Bucket b
                    && gameId.equals(b.gameId)
                    && partySize == b.partySize
                    && Objects.equals(region, b.region)
                    && Objects.equals(language, b.language);
        }

        @Override
        public int hashCode() {
            return Objects.hash(gameId, partySize, region, language);
        }
    }
}
