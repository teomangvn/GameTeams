package com.gameteams.voice;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import com.gameteams.config.StompPrincipal;
import com.gameteams.voice.VoiceDtos.VoiceEvent;

/**
 * Sekme kapandiginda veya ag koptugunda kullanici ses kanalindan dusurulur.
 *
 * Bu olmadan kanal listesinde hayalet katilimcilar birikir ve digerleri
 * kapanmis peer baglantilarini beklemeye devam eder.
 */
@Component
public class VoiceDisconnectListener {

    private static final Logger log = LoggerFactory.getLogger(VoiceDisconnectListener.class);

    private final VoiceStateService voiceState;
    private final SimpMessagingTemplate broker;

    VoiceDisconnectListener(VoiceStateService voiceState, SimpMessagingTemplate broker) {
        this.voiceState = voiceState;
        this.broker = broker;
    }

    @EventListener
    public void onDisconnect(SessionDisconnectEvent event) {
        if (!(event.getUser() instanceof StompPrincipal principal)) {
            return;
        }

        voiceState.currentChannelOf(principal.userId()).ifPresent(channelId ->
                voiceState.find(channelId, principal.userId()).ifPresent(participant -> {
                    voiceState.leave(channelId, principal.userId());
                    broker.convertAndSend("/topic/voice." + channelId,
                            VoiceEvent.left(channelId, participant));
                    log.debug("Baglanti koptu, ses kanalindan cikarildi: {} / {}",
                            principal.userId(), channelId);
                }));
    }
}
