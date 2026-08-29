package com.gameteams.room;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Quick Match ile acilan gecici odalari temizler.
 *
 * Oda uyesiz kaldiginda hemen silinmez: kisa bir sure beklenir ki yeniden
 * baglanan oyuncu odayi kaybetmesin. Suresi dolmus bos odalar birikirse
 * kullanicinin oda listesi kullanilamaz hale gelirdi.
 */
@Component
public class TemporaryRoomCleanupJob {

    private static final Logger log = LoggerFactory.getLogger(TemporaryRoomCleanupJob.class);
    private static final Duration GRACE_PERIOD = Duration.ofMinutes(30);

    private final RoomRepository rooms;
    private final RoomMemberRepository members;

    TemporaryRoomCleanupJob(RoomRepository rooms, RoomMemberRepository members) {
        this.rooms = rooms;
        this.members = members;
    }

    @Scheduled(fixedDelay = 300_000)
    @Transactional
    public void cleanUp() {
        Instant cutoff = Instant.now().minus(GRACE_PERIOD);
        List<Room> stale = rooms.findTemporaryCreatedBefore(cutoff);

        int removed = 0;
        for (Room room : stale) {
            if (members.countByRoomId(room.getId()) == 0) {
                rooms.delete(room);
                removed++;
            }
        }

        if (removed > 0) {
            log.info("{} bos gecici oda temizlendi", removed);
        }
    }
}
