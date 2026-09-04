package com.gameteams.auth;

import java.time.Instant;

import com.gameteams.user.User;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * Bekleyen e-posta değişikliği.
 *
 * Yeni adres doğrulanana kadar users.email'e yazılmaz: yanlış yazılan bir
 * adres hesabı kurtarılamaz hale getirirdi, çünkü şifre sıfırlama bağlantısı
 * da oraya giderdi.
 */
@Entity
@Table(name = "email_change_tokens")
public class EmailChangeToken extends OneTimeToken {

    @Column(name = "new_email", nullable = false, length = 255)
    private String newEmail;

    protected EmailChangeToken() {
    }

    public EmailChangeToken(User user, String newEmail, String tokenHash, Instant expiresAt) {
        super(user, tokenHash, expiresAt);
        this.newEmail = newEmail;
    }

    public String getNewEmail() {
        return newEmail;
    }
}
