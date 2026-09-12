package com.gameteams.auth.oauth;

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

/** Kullaniciya bagli bir harici hesap (Google, Facebook). */
@Entity
@Table(name = "user_identities")
public class UserIdentity {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 32)
    private String provider;

    /** Saglayicidaki degismez kimlik (Google "sub", Facebook "id"). */
    @Column(nullable = false, length = 255)
    private String subject;

    @Column(length = 255)
    private String email;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "last_login_at")
    private Instant lastLoginAt;

    protected UserIdentity() {
        // JPA
    }

    public UserIdentity(User user, String provider, String subject, String email) {
        this.user = user;
        this.provider = provider;
        this.subject = subject;
        this.email = email;
    }

    @PrePersist
    void onCreate() {
        this.createdAt = Instant.now();
    }

    public User getUser() {
        return user;
    }

    public String getProvider() {
        return provider;
    }

    public String getSubject() {
        return subject;
    }

    public void recordLogin(String currentEmail) {
        this.lastLoginAt = Instant.now();
        this.email = currentEmail;
    }
}
