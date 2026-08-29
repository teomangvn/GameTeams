package com.gameteams.auth;

import java.util.UUID;

import com.gameteams.user.Role;

/**
 * SecurityContext'te taşınan hafif kimlik. Controller'lar
 * {@code @AuthenticationPrincipal AuthenticatedUser} ile alır — her istekte
 * kullanıcıyı veritabanından çekmeye gerek kalmaz.
 */
public record AuthenticatedUser(UUID id, String username, Role role) {

    public boolean isAdmin() {
        return role == Role.ADMIN;
    }
}
