package com.gameteams.message;

import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import com.gameteams.config.StompPrincipal;
import com.gameteams.message.MessageDtos.ChannelEvent;
import com.gameteams.message.MessageDtos.SendMessageRequest;
import com.gameteams.message.MessageDtos.TypingEvent;

/**
 * STOMP uclari. Yetki kontrolu servis katmaninda yapilir; kanal id bilmek
 * tek basina yayin hakki vermez.
 */
@Controller
public class ChatSocketController {

    private static final Logger log = LoggerFactory.getLogger(ChatSocketController.class);

    private final MessageService messageService;
    private final SimpMessagingTemplate broker;

    ChatSocketController(MessageService messageService, SimpMessagingTemplate broker) {
        this.messageService = messageService;
        this.broker = broker;
    }

    @MessageMapping("/channel.{channelId}.send")
    public void send(@DestinationVariable UUID channelId, SendMessageRequest request,
            StompPrincipal principal) {
        try {
            var message = messageService.send(channelId, principal.userId(),
                    request.content(), request.replyToId());
            broker.convertAndSend("/topic/channel." + channelId, ChannelEvent.created(message));
        }
        catch (RuntimeException ex) {
            // STOMP'ta HTTP durum kodu yok; hata yalnizca gonderen kisiye gider.
            log.debug("Mesaj gonderilemedi ({}): {}", principal.userId(), ex.getMessage());
            broker.convertAndSendToUser(principal.getName(), "/queue/errors",
                    new SocketError("SEND_FAILED", ex.getMessage()));
        }
    }

    @MessageMapping("/channel.{channelId}.typing")
    public void typing(@DestinationVariable UUID channelId, StompPrincipal principal) {
        // Yaziyor bilgisi kalici degil; dogrulama maliyeti getirisinden buyuk
        // oldugu icin yalnizca kanala yayinlanir.
        broker.convertAndSend("/topic/channel." + channelId,
                TypingEvent.of(channelId, principal.userId(), principal.displayName()));
    }

    public record SocketError(String code, String message) {
    }
}
