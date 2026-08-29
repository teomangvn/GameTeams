package com.gameteams.user;

import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import org.springframework.web.socket.messaging.SessionSubscribeEvent;

import com.gameteams.config.StompPrincipal;

/**
 * Cevrimici durumu WebSocket baglantisina bagli tutar.
 *
 * Abonelik olaylarinda da tazelenir: uzun sureli acik oturumlarda presence
 * TTL'i dolup kullanici yanlislikla cevrimdisi gorunmesin.
 */
@Component
public class PresenceListener {

    private final PresenceService presence;

    PresenceListener(PresenceService presence) {
        this.presence = presence;
    }

    @EventListener
    public void onConnected(SessionConnectedEvent event) {
        userIdOf(event.getUser()).ifPresent(presence::markOnline);
    }

    @EventListener
    public void onSubscribe(SessionSubscribeEvent event) {
        userIdOf(event.getUser()).ifPresent(presence::markOnline);
    }

    @EventListener
    public void onDisconnect(SessionDisconnectEvent event) {
        userIdOf(event.getUser()).ifPresent(presence::markOffline);
    }

    private java.util.Optional<java.util.UUID> userIdOf(java.security.Principal principal) {
        return principal instanceof StompPrincipal stomp
                ? java.util.Optional.of(stomp.userId())
                : java.util.Optional.empty();
    }
}
