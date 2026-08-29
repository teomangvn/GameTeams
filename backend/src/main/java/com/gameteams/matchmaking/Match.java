package com.gameteams.matchmaking;

import java.time.Instant;
import java.util.UUID;

import com.gameteams.room.Room;

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
@Table(name = "matches")
public class Match {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "game_id", nullable = false)
    private Game game;

    @Column(name = "party_size", nullable = false)
    private int partySize;

    @Column(length = 16)
    private String region;

    @Column(length = 8)
    private String language;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private MatchStatus status = MatchStatus.FORMING;

    /** Eslesme kuruldugunda acilan gecici oda. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id")
    private Room room;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "closed_at")
    private Instant closedAt;

    protected Match() {
    }

    public Match(Game game, int partySize, String region, String language) {
        this.game = game;
        this.partySize = partySize;
        this.region = region;
        this.language = language;
    }

    @PrePersist
    void onCreate() {
        this.createdAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public Game getGame() {
        return game;
    }

    public int getPartySize() {
        return partySize;
    }

    public String getRegion() {
        return region;
    }

    public String getLanguage() {
        return language;
    }

    public MatchStatus getStatus() {
        return status;
    }

    public Room getRoom() {
        return room;
    }

    public void activateWith(Room room) {
        this.room = room;
        this.status = MatchStatus.ACTIVE;
    }

    public void close() {
        this.status = MatchStatus.CLOSED;
        this.closedAt = Instant.now();
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
