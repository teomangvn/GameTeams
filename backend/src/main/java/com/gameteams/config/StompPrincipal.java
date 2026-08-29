package com.gameteams.config;

import java.security.Principal;
import java.util.UUID;

import com.gameteams.auth.AuthenticatedUser;

/**
 * STOMP oturumunun kimligi. Principal.getName() kullanici id'sini doner;
 * "/user/{id}/queue/..." hedeflemesi bu isim uzerinden calisir.
 */
public record StompPrincipal(AuthenticatedUser user) implements Principal {

    @Override
    public String getName() {
        return user.id().toString();
    }

    public UUID userId() {
        return user.id();
    }

    public String displayName() {
        return user.username();
    }
}
