package com.gameteams.auth;

import java.time.Instant;

import com.gameteams.user.User;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "password_reset_tokens")
public class PasswordResetToken extends OneTimeToken {

    protected PasswordResetToken() {
    }

    public PasswordResetToken(User user, String tokenHash, Instant expiresAt) {
        super(user, tokenHash, expiresAt);
    }
}
