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
 * Tanınmayan bir cihazdan yapılan giriş denemesi.
 *
 * Kullanıcı kimliğini doğru girmiştir ama oturum henüz açılmaz; e-postasına
 * giden 6 haneli kod girilene kadar token üretilmez.
 */
@Entity
@Table(name = "login_challenges")
public class LoginChallenge {

    /** 6 hane yalnızca bir milyon olasılık; deneme sayısı sınırlanmalı. */
    public static final int MAX_ATTEMPTS = 5;

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "code_hash", nullable = false, length = 64)
    private String codeHash;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "consumed_at")
    private Instant consumedAt;

    @Column(nullable = false)
    private int attempts;

    @Column(name = "user_agent", length = 512)
    private String userAgent;

    @Column(length = 64)
    private String ip;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    protected LoginChallenge() {
    }

    public LoginChallenge(User user, String codeHash, Instant expiresAt, String userAgent, String ip) {
        this.user = user;
        this.codeHash = codeHash;
        this.expiresAt = expiresAt;
        this.userAgent = userAgent;
        this.ip = ip;
    }

    public UUID getId() {
        return id;
    }

    public User getUser() {
        return user;
    }

    public String getCodeHash() {
        return codeHash;
    }

    public int getAttempts() {
        return attempts;
    }

    public void recordAttempt() {
        attempts++;
    }

    public void consume() {
        consumedAt = Instant.now();
    }

    /** Kullanılmamış, süresi dolmamış ve deneme hakkı bitmemiş mi? */
    public boolean isUsable() {
        return consumedAt == null
                && attempts < MAX_ATTEMPTS
                && expiresAt.isAfter(Instant.now());
    }
}
