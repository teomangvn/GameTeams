package com.gameteams.room;

import java.util.List;
import java.util.UUID;

/**
 * Bir veya daha fazla kullanicinin odayla bagi koptu.
 *
 * Uygulama ici olay: RoomService yayinlar, islem kaydedildikten sonra
 * dinleyiciler calisir (arayuze duyuru, ses kanalindan cikarma). Oda servisi
 * ses ve soket katmanini bilmek zorunda kalmaz.
 *
 * @param voiceChannelIds odanin ses kanallari; oda silinince kanallar da
 *                        gittigi icin silmeden once toplanir
 */
public record RoomMembershipEnded(
        UUID roomId,
        String roomName,
        Reason reason,
        List<UUID> userIds,
        List<UUID> voiceChannelIds) {

    public enum Reason {
        /** Kullanici kendisi ayrildi. */
        LEFT,
        /** Oda sahibi cikardi. */
        REMOVED,
        /** Oda silindi; butun uyeler etkilenir. */
        ROOM_DELETED
    }
}
