package com.gameteams.block;

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
import jakarta.persistence.Table;

/** Bir kullanicinin baska birini engellemesi. Yonludur: A'nin engeli B'ninkinden bagimsiz. */
@Entity
@Table(name = "user_blocks")
public class UserBlock {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "blocker_id", nullable = false)
    private User blocker;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "blocked_id", nullable = false)
    private User blocked;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected UserBlock() {
    }

    public UserBlock(User blocker, User blocked) {
        this.blocker = blocker;
        this.blocked = blocked;
    }

    @PrePersist
    void onCreate() {
        this.createdAt = Instant.now();
    }

    public User getBlocker() {
        return blocker;
    }

    public User getBlocked() {
        return blocked;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
