package com.gameteams.friend;

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

/**
 * Arkadaslik iliskisi. Yon korunur (kimin istedigi bilinsin diye) ama mantiksal
 * olarak simetriktir: kabul edildiginde iki taraf da digerinin arkadasidir.
 */
@Entity
@Table(name = "friendships")
public class Friendship {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "requester_id", nullable = false)
    private User requester;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "addressee_id", nullable = false)
    private User addressee;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private FriendshipStatus status = FriendshipStatus.PENDING;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "responded_at")
    private Instant respondedAt;

    protected Friendship() {
    }

    public Friendship(User requester, User addressee) {
        this.requester = requester;
        this.addressee = addressee;
    }

    @PrePersist
    void onCreate() {
        this.createdAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public User getRequester() {
        return requester;
    }

    public User getAddressee() {
        return addressee;
    }

    public FriendshipStatus getStatus() {
        return status;
    }

    public void accept() {
        this.status = FriendshipStatus.ACCEPTED;
        this.respondedAt = Instant.now();
    }

    public void block() {
        this.status = FriendshipStatus.BLOCKED;
        this.respondedAt = Instant.now();
    }

    public boolean isAccepted() {
        return status == FriendshipStatus.ACCEPTED;
    }

    /** Iliskideki diger taraf. */
    public User otherThan(UUID userId) {
        return requester.getId().equals(userId) ? addressee : requester;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getRespondedAt() {
        return respondedAt;
    }
}
