package com.gameteams.matchmaking;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import com.gameteams.user.User;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "matchmaking_tickets")
public class MatchmakingTicket {

    /** Bekleme suresiyle toleransin genisleme adimi. */
    private static final Duration TOLERANCE_STEP = Duration.ofSeconds(30);
    private static final int MAX_TOLERANCE = 5;

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "game_id", nullable = false)
    private Game game;

    @Column(name = "party_size", nullable = false)
    private int partySize;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "rank_id")
    private GameRank rank;

    @Column(name = "rank_tolerance", nullable = false)
    private int rankTolerance = 1;

    @Column(length = 16)
    private String region;

    @Column(length = 8)
    private String language;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private TicketStatus status = TicketStatus.QUEUED;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "match_id")
    private Match match;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    protected MatchmakingTicket() {
    }

    public MatchmakingTicket(User user, Game game, int partySize, GameRank rank,
            String region, String language, Instant expiresAt) {
        this.user = user;
        this.game = game;
        this.partySize = partySize;
        this.rank = rank;
        this.region = region;
        this.language = language;
        this.expiresAt = expiresAt;
    }

    @PrePersist
    void onCreate() {
        this.createdAt = Instant.now();
    }

    /**
     * Bekledikce daha genis rank araligi kabul edilir. Boylece nadir rank'taki
     * oyuncular sonsuza kadar kuyrukta kalmaz; ilk saniyelerde ise eslesme
     * mumkun oldugunca dar tutulur.
     */
    public int effectiveTolerance(Instant now) {
        long steps = Duration.between(createdAt, now).dividedBy(TOLERANCE_STEP);
        return (int) Math.min(MAX_TOLERANCE, rankTolerance + Math.max(0, steps));
    }

    public Integer tierOrder() {
        return rank != null ? rank.getTierOrder() : null;
    }

    public void markMatched(Match match) {
        this.match = match;
        this.status = TicketStatus.MATCHED;
    }

    public void cancel() {
        this.status = TicketStatus.CANCELLED;
    }

    public void expire() {
        this.status = TicketStatus.EXPIRED;
    }

    public UUID getId() {
        return id;
    }

    public User getUser() {
        return user;
    }

    public Game getGame() {
        return game;
    }

    public int getPartySize() {
        return partySize;
    }

    public GameRank getRank() {
        return rank;
    }

    public String getRegion() {
        return region;
    }

    public String getLanguage() {
        return language;
    }

    public TicketStatus getStatus() {
        return status;
    }

    public Match getMatch() {
        return match;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }
}
