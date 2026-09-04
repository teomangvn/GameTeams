package com.gameteams.user;

import java.security.Principal;
import java.util.Optional;
import java.util.UUID;

import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import org.springframework.web.socket.messaging.SessionSubscribeEvent;

import com.gameteams.config.StompPrincipal;
import com.gameteams.room.RoomDtos.RoomEvent;
import com.gameteams.room.RoomMemberRepository;

/**
 * Cevrimici durumu WebSocket baglantisina bagli tutar ve degisikligi
 * kullanicinin odalarina duyurur.
 *
 * Abonelik olaylarinda da tazelenir: uzun sureli acik oturumlarda presence
 * TTL'i dolup kullanici yanlislikla cevrimdisi gorunmesin.
 *
 * Yayin olmadan uye listesindeki cevrimici gostergesi ancak periyodik
 * yoklamayla guncelleniyordu; artik degisiklik aninda ulasiyor.
 */
@Component
public class PresenceListener {

    private final PresenceService presence;
    private final RoomMemberRepository members;
    private final SimpMessagingTemplate broker;

    PresenceListener(PresenceService presence, RoomMemberRepository members,
            SimpMessagingTemplate broker) {
        this.presence = presence;
        this.members = members;
        this.broker = broker;
    }

    @EventListener
    public void onConnected(SessionConnectedEvent event) {
        userIdOf(event.getUser()).ifPresent(userId -> {
            presence.markOnline(userId);
            announce(userId, true);
        });
    }

    /** Yalnizca TTL tazeleme; durum degismedigi icin duyuru yapilmaz. */
    @EventListener
    public void onSubscribe(SessionSubscribeEvent event) {
        userIdOf(event.getUser()).ifPresent(presence::markOnline);
    }

    @EventListener
    public void onDisconnect(SessionDisconnectEvent event) {
        userIdOf(event.getUser()).ifPresent(userId -> {
            presence.markOffline(userId);
            announce(userId, false);
        });
    }

    /**
     * Kullanicinin uyesi oldugu her odaya durum degisikligini yayinlar.
     *
     * Yayin hatasi baglanti yasam dongusunu bozmamali: gosterge guncellenmezse
     * liste bir sonraki acilista dogruyu gosterir, ama burada firlatilan bir
     * istisna oturum temizligini yarida birakirdi.
     */
    @Transactional(readOnly = true)
    void announce(UUID userId, boolean online) {
        try {
            RoomEvent event = RoomEvent.presence(userId, online);
            for (UUID roomId : members.findRoomIdsByUserId(userId)) {
                broker.convertAndSend("/topic/room." + roomId, event);
            }
        }
        catch (RuntimeException ignored) {
            // Gosterge guncellenemedi; oturum akisi etkilenmemeli.
        }
    }

    private Optional<UUID> userIdOf(Principal principal) {
        return principal instanceof StompPrincipal stomp
                ? Optional.of(stomp.userId())
                : Optional.empty();
    }
}
