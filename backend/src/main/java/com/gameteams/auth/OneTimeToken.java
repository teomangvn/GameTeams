package com.gameteams.auth;

import java.time.Instant;
import java.util.UUID;

import com.gameteams.user.User;

import jakarta.persistence.Column;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.PrePersist;

/**
 * E-posta doğrulama ve şifre sıfırlama token'larının ortak yapısı: tek
 * kullanımlık, süreli ve yalnızca SHA-256 özeti saklanan değerler.
 */
@MappedSuperclass
public abstract class OneTimeToken {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "token_hash", nullable = false, length = 64, unique = true)
    private String tokenHash;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "used_at")
    private Instant usedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected OneTimeToken() {
    }

    protected OneTimeToken(User user, String tokenHash, Instant expiresAt) {
        this.user = user;
        this.tokenHash = tokenHash;
        this.expiresAt = expiresAt;
    }

    @PrePersist
    void onCreate() {
        this.createdAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public User getUser() {
        return user;
    }

    public void markUsed() {
        this.usedAt = Instant.now();
    }

    /** Kullanılmamış ve süresi dolmamış mı? */
    public boolean isUsable() {
        return usedAt == null && expiresAt.isAfter(Instant.now());
    }
}
