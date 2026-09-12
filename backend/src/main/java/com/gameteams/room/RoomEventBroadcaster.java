package com.gameteams.room;

import java.util.UUID;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import com.gameteams.room.RoomDtos.RoomEvent;
import com.gameteams.room.RoomDtos.RoomNotice;

/**
 * Uyelik degisikliklerini istemcilere duyurur.
 *
 * Islem kaydedildikten sonra calisir: once yayinlanirsa istemci listeyi
 * yeniden cekip hala eski durumu gorebilirdi.
 *
 * Iki kanal kullanilir:
 *  - /topic/room.{id}: odayi o an acik olanlarin uye listesi tazelensin.
 *  - /user/queue/rooms: etkilenen kullanici odaya bakmiyor olsa bile haberdar
 *    olsun; aksi halde silinmis bir oda listesinde durmaya devam ederdi.
 */
@Component
class RoomEventBroadcaster {

    private final SimpMessagingTemplate broker;

    RoomEventBroadcaster(SimpMessagingTemplate broker) {
        this.broker = broker;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    void onMembershipEnded(RoomMembershipEnded event) {
        String topic = "/topic/room." + event.roomId();

        switch (event.reason()) {
            case LEFT -> event.userIds().forEach(userId ->
                    broker.convertAndSend(topic, RoomEvent.memberLeft(userId)));
            case REMOVED -> event.userIds().forEach(userId -> {
                broker.convertAndSend(topic, RoomEvent.memberRemoved(userId));
                notice(userId, "REMOVED_FROM_ROOM", event);
            });
            case ROOM_DELETED -> {
                broker.convertAndSend(topic, RoomEvent.roomDeleted());
                event.userIds().forEach(userId -> notice(userId, "ROOM_DELETED", event));
            }
        }
    }

    private void notice(UUID userId, String type, RoomMembershipEnded event) {
        broker.convertAndSendToUser(userId.toString(), "/queue/rooms",
                new RoomNotice(type, event.roomId(), event.roomName()));
    }
}
