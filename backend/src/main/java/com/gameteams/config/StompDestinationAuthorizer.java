package com.gameteams.config;

import java.util.UUID;

import org.springframework.stereotype.Component;

import com.gameteams.channel.ChannelService;
import com.gameteams.common.ApiException;
import com.gameteams.room.RoomService;

/**
 * STOMP abonelik yetkilendirmesi.
 *
 * Spring'in bellek ici broker'i SUBSCRIBE frame'lerini dogrulamaz: kanal id
 * bilen herkes /topic/channel.{id} hedefine abone olup mesajlari okuyabilir.
 * REST tarafindaki uyelik kontrolu WebSocket'e otomatik yansimaz, bu yuzden
 * ayni kontrol burada tekrar uygulanir.
 *
 * Taninmayan hedefler varsayilan olarak reddedilir: yeni bir topic eklenirken
 * yetkilendirmesini yazmak unutulursa sizdirmak yerine calismaz.
 */
@Component
public class StompDestinationAuthorizer {

    private static final String CHANNEL_PREFIX = "/topic/channel.";
    private static final String VOICE_PREFIX = "/topic/voice.";
    private static final String ROOM_PREFIX = "/topic/room.";

    private final ChannelService channelService;
    private final RoomService roomService;

    StompDestinationAuthorizer(ChannelService channelService, RoomService roomService) {
        this.channelService = channelService;
        this.roomService = roomService;
    }

    public void authorizeSubscription(String destination, UUID userId) {
        if (destination == null || destination.isBlank()) {
            throw new IllegalArgumentException("Abonelik hedefi bos olamaz.");
        }

        // Spring, /user/** hedeflerini oturumun principal'ina gore cozer;
        // kullanici baskasinin kuyrugunu dinleyemez.
        if (destination.startsWith("/user/")) {
            return;
        }

        try {
            if (destination.startsWith(CHANNEL_PREFIX)) {
                channelService.requireAccessibleChannel(
                        parseId(destination, CHANNEL_PREFIX), userId);
                return;
            }
            if (destination.startsWith(VOICE_PREFIX)) {
                channelService.requireAccessibleChannel(
                        parseId(destination, VOICE_PREFIX), userId);
                return;
            }
            if (destination.startsWith(ROOM_PREFIX)) {
                roomService.requireMember(parseId(destination, ROOM_PREFIX), userId);
                return;
            }
        }
        catch (ApiException ex) {
            throw new IllegalArgumentException("Bu hedefe abone olamazsin.", ex);
        }

        throw new IllegalArgumentException("Bilinmeyen abonelik hedefi: " + destination);
    }

    private UUID parseId(String destination, String prefix) {
        try {
            return UUID.fromString(destination.substring(prefix.length()));
        }
        catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Hedefteki kimlik gecersiz.", ex);
        }
    }
}
