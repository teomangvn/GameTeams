package com.gameteams.voice;

import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import com.gameteams.channel.Channel;
import com.gameteams.channel.ChannelService;
import com.gameteams.channel.ChannelType;
import com.gameteams.common.ApiException;
import com.gameteams.config.StompPrincipal;
import com.gameteams.user.User;
import com.gameteams.user.UserRepository;
import com.gameteams.voice.VoiceDtos.SignalMessage;
import com.gameteams.voice.VoiceDtos.VoiceEvent;
import com.gameteams.voice.VoiceDtos.VoiceParticipant;
import com.gameteams.voice.VoiceDtos.VoiceStateRequest;

/**
 * Ses kanali katilim/ayrilma ve WebRTC signaling.
 *
 * Sunucu ses tasimaz; yalnizca kimin nerede oldugunu bilir ve SDP/ICE
 * paketlerini hedef kullaniciya iletir. Ses tarayicilar arasinda P2P akar.
 */
@Controller
public class VoiceSocketController {

    private static final Logger log = LoggerFactory.getLogger(VoiceSocketController.class);
    private static final int DEFAULT_USER_LIMIT = 6;

    private final VoiceStateService voiceState;
    private final ChannelService channelService;
    private final UserRepository users;
    private final SimpMessagingTemplate broker;

    VoiceSocketController(VoiceStateService voiceState, ChannelService channelService,
            UserRepository users, SimpMessagingTemplate broker) {
        this.voiceState = voiceState;
        this.channelService = channelService;
        this.users = users;
        this.broker = broker;
    }

    @MessageMapping("/voice.{channelId}.join")
    public void join(@DestinationVariable UUID channelId, StompPrincipal principal) {
        try {
            Channel channel = channelService.requireAccessibleChannel(channelId, principal.userId());
            if (channel.getType() != ChannelType.VOICE) {
                throw ApiException.badRequest("NOT_A_VOICE_CHANNEL",
                        "Bu kanal ses kanali degil.");
            }

            User user = users.findById(principal.userId())
                    .orElseThrow(() -> ApiException.unauthorized("USER_NOT_FOUND",
                            "Hesabin bulunamadi."));

            VoiceParticipant participant = new VoiceParticipant(
                    user.getId(), user.getUsername(), user.getDisplayName(), user.getAvatarUrl(),
                    false, false, false, false);

            int limit = channel.getUserLimit() != null ? channel.getUserLimit() : DEFAULT_USER_LIMIT;
            voiceState.join(channelId, participant, limit)
                    // Onceki kanaldan ayrilma da duyurulmali, yoksa oradaki
                    // katilimcilar peer baglantisini kapatmaz.
                    .ifPresent(previous -> broadcast(previous, VoiceEvent.left(previous, participant)));

            broadcast(channelId, VoiceEvent.joined(channelId, participant));
        }
        catch (RuntimeException ex) {
            sendError(principal, "VOICE_JOIN_FAILED", ex.getMessage());
        }
    }

    @MessageMapping("/voice.{channelId}.leave")
    public void leave(@DestinationVariable UUID channelId, StompPrincipal principal) {
        voiceState.find(channelId, principal.userId()).ifPresent(participant -> {
            voiceState.leave(channelId, principal.userId());
            broadcast(channelId, VoiceEvent.left(channelId, participant));
        });
    }

    @MessageMapping("/voice.{channelId}.state")
    public void updateState(@DestinationVariable UUID channelId, VoiceStateRequest request,
            StompPrincipal principal) {
        voiceState.updateState(channelId, principal.userId(),
                        request.muted(), request.deafened(), request.screenSharing(),
                        request.cameraOn())
                .ifPresent(updated -> broadcast(channelId, VoiceEvent.stateChanged(channelId, updated)));
    }

    /**
     * SDP/ICE aktarimi. Gonderen ve alicinin ayni ses kanalinda olmasi sart:
     * aksi halde herhangi biri baskasina signaling paketi gonderebilirdi.
     */
    @MessageMapping("/signal")
    public void signal(SignalMessage message, StompPrincipal principal) {
        UUID senderId = principal.userId();

        var senderChannel = voiceState.currentChannelOf(senderId);
        var targetChannel = voiceState.currentChannelOf(message.targetUserId());

        if (senderChannel.isEmpty() || !senderChannel.equals(targetChannel)) {
            log.debug("Signaling reddedildi: {} -> {} ayni kanalda degil",
                    senderId, message.targetUserId());
            sendError(principal, "SIGNAL_REJECTED", "Hedef kullanici ayni ses kanalinda degil.");
            return;
        }

        // fromUserId istemciden gelmez; sunucu doldurur ki kimlik taklidi olmasin.
        SignalMessage relayed = new SignalMessage(
                message.targetUserId(), senderId, senderChannel.get(),
                message.type(), message.payload());

        broker.convertAndSendToUser(message.targetUserId().toString(), "/queue/signal", relayed);
    }

    private void broadcast(UUID channelId, VoiceEvent event) {
        broker.convertAndSend("/topic/voice." + channelId, event);
    }

    private void sendError(StompPrincipal principal, String code, String message) {
        broker.convertAndSendToUser(principal.getName(), "/queue/errors",
                new VoiceError(code, message));
    }

    public record VoiceError(String code, String message) {
    }
}
