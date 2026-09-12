package com.gameteams.voice;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import com.gameteams.room.RoomMembershipEnded;
import com.gameteams.voice.VoiceDtos.VoiceEvent;

/**
 * Odayla bagi kopan kullaniciyi o odanin ses kanalindan cikarir.
 *
 * Ses katilimi yalnizca girerken dogrulaniyordu: odadan atilan biri ses
 * kanalinda kalip konusmayi dinlemeye devam edebiliyordu. Oda silindiginde
 * de kanallar gitmesine ragmen Redis'te hayalet katilimcilar kaliyordu.
 */
@Component
class VoiceRoomEvictionListener {

    private static final Logger log = LoggerFactory.getLogger(VoiceRoomEvictionListener.class);

    private final VoiceStateService voiceState;
    private final SimpMessagingTemplate broker;

    VoiceRoomEvictionListener(VoiceStateService voiceState, SimpMessagingTemplate broker) {
        this.voiceState = voiceState;
        this.broker = broker;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    void onMembershipEnded(RoomMembershipEnded event) {
        Set<UUID> roomChannels = new HashSet<>(event.voiceChannelIds());
        if (roomChannels.isEmpty()) {
            return;
        }

        try {
            for (UUID userId : event.userIds()) {
                voiceState.currentChannelOf(userId)
                        .filter(roomChannels::contains)
                        .ifPresent(channelId -> voiceState.find(channelId, userId).ifPresent(participant -> {
                            voiceState.leave(channelId, userId);
                            broker.convertAndSend("/topic/voice." + channelId,
                                    VoiceEvent.left(channelId, participant));
                            log.info("Oda uyeligi bitti, ses kanalindan cikarildi: {} / {}",
                                    participant.username(), channelId);
                        }));
            }
        }
        catch (RuntimeException ex) {
            // Uyelik degisikligi zaten kaydedildi; ses temizligi basarisiz olsa
            // bile katilimci baglanti kopunca duser.
            log.warn("Ses kanalindan cikarma basarisiz: oda {}", event.roomId(), ex);
        }
    }
}
