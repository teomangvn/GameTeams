package com.gameteams.auth;

import java.time.Instant;

import com.gameteams.user.User;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "email_verification_tokens")
public class EmailVerificationToken extends OneTimeToken {

    protected EmailVerificationToken() {
    }

    public EmailVerificationToken(User user, String tokenHash, Instant expiresAt) {
        super(user, tokenHash, expiresAt);
    }
}
