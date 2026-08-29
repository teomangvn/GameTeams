package com.gameteams.matchmaking;

import java.time.Instant;
import java.util.UUID;

import com.gameteams.user.User;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

/** Kullanicinin bir oyundaki rank ve takma adi. */
@Entity
@Table(name = "user_game_profiles")
public class UserGameProfile {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "game_id", nullable = false)
    private Game game;

    @Column(name = "in_game_name", length = 64)
    private String inGameName;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "rank_id")
    private GameRank rank;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected UserGameProfile() {
    }

    public UserGameProfile(User user, Game game) {
        this.user = user;
        this.game = game;
    }

    @PrePersist
    @PreUpdate
    void touch() {
        this.updatedAt = Instant.now();
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

    public String getInGameName() {
        return inGameName;
    }

    public void setInGameName(String inGameName) {
        this.inGameName = inGameName;
    }

    public GameRank getRank() {
        return rank;
    }

    public void setRank(GameRank rank) {
        this.rank = rank;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
