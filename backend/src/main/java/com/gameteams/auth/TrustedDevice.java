package com.gameteams.auth;

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
import jakarta.persistence.Table;

/**
 * "Bu cihazı hatırla" işaretlenmiş bir tarayıcı.
 *
 * Çerezdeki ham token yalnızca istemcide durur; burada özeti saklanır.
 */
@Entity
@Table(name = "trusted_devices")
public class TrustedDevice {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "token_hash", nullable = false, length = 64, unique = true)
    private String tokenHash;

    @Column(length = 255)
    private String label;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "last_used_at")
    private Instant lastUsedAt;

    protected TrustedDevice() {
    }

    public TrustedDevice(User user, String tokenHash, String label, Instant expiresAt) {
        this.user = user;
        this.tokenHash = tokenHash;
        this.label = label;
        this.expiresAt = expiresAt;
    }

    public User getUser() {
        return user;
    }

    public boolean isValid() {
        return expiresAt.isAfter(Instant.now());
    }

    public void touch() {
        lastUsedAt = Instant.now();
    }
}
