package com.gameteams.voice;

import java.time.Duration;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import com.gameteams.common.ApiException;
import com.gameteams.common.RateLimiter;
import com.gameteams.config.StompPrincipal;
import com.gameteams.dm.DmConversation;
import com.gameteams.dm.DmService;
import com.gameteams.user.PresenceService;
import com.gameteams.user.User;

/**
 * Birebir sesli arama sinyalleri: cagri, ret ve iptal.
 *
 * Arama ses alani olarak DM sohbetinin kimligini kullanir; baglanti mevcut ses
 * akisiyla kurulur (bkz. VoiceAccessService). Bu sinif yalnizca karsi tarafi
 * haberdar eder -- kabul etmek ayrica bir mesaj degil, ayni ses alanina
 * katilmaktir. Boylece "kabul edildi ama baglanti kurulmadi" diye ayri bir
 * durum olusmaz.
 */
@Controller
public class CallSocketController {

    private static final Logger log = LoggerFactory.getLogger(CallSocketController.class);
    private static final String QUEUE = "/queue/calls";

    private final DmService dmService;
    private final PresenceService presence;
    private final RateLimiter rateLimiter;
    private final SimpMessagingTemplate broker;

    CallSocketController(DmService dmService, PresenceService presence, RateLimiter rateLimiter,
            SimpMessagingTemplate broker) {
        this.dmService = dmService;
        this.presence = presence;
        this.rateLimiter = rateLimiter;
        this.broker = broker;
    }

    /** Karsi tarafi arar. Cevrimdisiysa arayana hemen soylenir; bosuna calmaz. */
    @MessageMapping("/call.{conversationId}.ring")
    public void ring(@DestinationVariable UUID conversationId, StompPrincipal principal) {
        try {
            // Bir kullanicinin baskasini surekli caldirip rahatsiz etmesini onler.
            rateLimiter.check("call-ring:" + principal.userId(), 10, Duration.ofMinutes(1),
                    "Çok fazla arama. Biraz bekle.");

            DmConversation conversation = dmService.requireParticipant(conversationId, principal.userId());
            User caller = self(conversation, principal.userId());
            User callee = conversation.otherThan(principal.userId());

            if (!presence.isOnline(callee.getId())) {
                send(caller.getId(), CallEvent.of("UNAVAILABLE", conversationId, callee));
                return;
            }

            send(callee.getId(), CallEvent.of("RINGING", conversationId, caller));
            log.info("Arama: {} -> {}", caller.getUsername(), callee.getUsername());
        }
        catch (ApiException ex) {
            sendError(principal, ex);
        }
    }

    /** Aranan taraf reddetti. */
    @MessageMapping("/call.{conversationId}.decline")
    public void decline(@DestinationVariable UUID conversationId, StompPrincipal principal) {
        notifyOther(conversationId, principal, "DECLINED");
    }

    /** Arayan, cevap gelmeden vazgecti; aranan tarafta calma durmali. */
    @MessageMapping("/call.{conversationId}.cancel")
    public void cancel(@DestinationVariable UUID conversationId, StompPrincipal principal) {
        notifyOther(conversationId, principal, "CANCELLED");
    }

    private void notifyOther(UUID conversationId, StompPrincipal principal, String type) {
        try {
            DmConversation conversation = dmService.requireParticipant(conversationId, principal.userId());
            User me = self(conversation, principal.userId());
            send(conversation.otherThan(principal.userId()).getId(), CallEvent.of(type, conversationId, me));
        }
        catch (ApiException ex) {
            sendError(principal, ex);
        }
    }

    private static User self(DmConversation conversation, UUID userId) {
        return conversation.getUserA().getId().equals(userId)
                ? conversation.getUserA()
                : conversation.getUserB();
    }

    private void send(UUID userId, CallEvent event) {
        broker.convertAndSendToUser(userId.toString(), QUEUE, event);
    }

    private void sendError(StompPrincipal principal, ApiException ex) {
        broker.convertAndSendToUser(principal.getName(), "/queue/errors",
                new VoiceSocketController.VoiceError(ex.code(), ex.getMessage()));
    }

    /**
     * /user/queue/calls olayi.
     *
     * @param user olayi tetikleyen karsi taraf (RINGING'de arayan, digerlerinde
     *             reddeden/iptal eden, UNAVAILABLE'da ulasilamayan kisi)
     */
    public record CallEvent(String type, UUID conversationId, CallParty user) {

        static CallEvent of(String type, UUID conversationId, User user) {
            return new CallEvent(type, conversationId,
                    new CallParty(user.getId(), user.getDisplayName(), user.getAvatarUrl()));
        }
    }

    public record CallParty(UUID userId, String displayName, String avatarUrl) {
    }
}
