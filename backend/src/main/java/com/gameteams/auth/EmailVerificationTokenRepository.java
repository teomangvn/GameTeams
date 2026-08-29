package com.gameteams.auth;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.gameteams.user.User;

public interface EmailVerificationTokenRepository
        extends JpaRepository<EmailVerificationToken, UUID> {

    Optional<EmailVerificationToken> findByTokenHash(String tokenHash);

    /** Yeni token üretmeden önce eskileri geçersizleştirir. */
    @Modifying
    @Query("update EmailVerificationToken t set t.usedAt = :now "
            + "where t.user = :user and t.usedAt is null")
    int invalidateAllForUser(@Param("user") User user, @Param("now") Instant now);
}
