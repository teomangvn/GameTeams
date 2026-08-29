package com.gameteams.matchmaking;

import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "games")
public class Game {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false, length = 48, unique = true)
    private String slug;

    @Column(nullable = false, length = 64)
    private String name;

    @Column(name = "icon_url")
    private String iconUrl;

    @Column(name = "min_team_size", nullable = false)
    private int minTeamSize;

    @Column(name = "max_team_size", nullable = false)
    private int maxTeamSize;

    @Column(name = "has_ranks", nullable = false)
    private boolean hasRanks;

    @Column(name = "is_active", nullable = false)
    private boolean active;

    protected Game() {
    }

    public UUID getId() {
        return id;
    }

    public String getSlug() {
        return slug;
    }

    public String getName() {
        return name;
    }

    public String getIconUrl() {
        return iconUrl;
    }

    public int getMinTeamSize() {
        return minTeamSize;
    }

    public int getMaxTeamSize() {
        return maxTeamSize;
    }

    public boolean hasRanks() {
        return hasRanks;
    }

    public boolean isActive() {
        return active;
    }
}
