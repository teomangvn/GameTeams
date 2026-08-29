package com.gameteams.auth;

import java.time.Instant;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.gameteams.user.User;

/**
 * Oturum iptalini <b>ayrı</b> bir transaction'da yürütür.
 *
 * Token hırsızlığı tespit edildiğinde iptalin ardından hata fırlatılır; aynı
 * transaction içinde yapılsaydı fırlatılan exception rollback tetikleyip iptali
 * geri alır ve çalınmış token geçerli kalmaya devam ederdi.
 */
@Component
class RefreshTokenRevoker {

    private final RefreshTokenRepository refreshTokens;

    RefreshTokenRevoker(RefreshTokenRepository refreshTokens) {
        this.refreshTokens = refreshTokens;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    void revokeAllForUser(User user) {
        refreshTokens.revokeAllForUser(user, Instant.now());
    }
}
