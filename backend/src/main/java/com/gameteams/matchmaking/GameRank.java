package com.gameteams.matchmaking;

import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/**
 * Bir oyundaki rank kademesi. tier_order kiyaslanabilir bir sayidir; eslestirici
 * iki oyuncunun kademe farkina bakar.
 */
@Entity
@Table(name = "game_ranks")
public class GameRank {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "game_id", nullable = false)
    private Game game;

    @Column(nullable = false, length = 48)
    private String name;

    @Column(name = "tier_order", nullable = false)
    private int tierOrder;

    @Column(name = "icon_url")
    private String iconUrl;

    protected GameRank() {
    }

    public UUID getId() {
        return id;
    }

    public Game getGame() {
        return game;
    }

    public String getName() {
        return name;
    }

    public int getTierOrder() {
        return tierOrder;
    }

    public String getIconUrl() {
        return iconUrl;
    }
}
