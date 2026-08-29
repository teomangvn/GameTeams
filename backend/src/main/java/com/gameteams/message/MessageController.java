package com.gameteams.message;

import java.util.UUID;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.gameteams.auth.AuthenticatedUser;
import com.gameteams.message.MessageDtos.ChannelEvent;
import com.gameteams.message.MessageDtos.EditMessageRequest;
import com.gameteams.message.MessageDtos.MessagePage;
import com.gameteams.message.MessageDtos.MessageResponse;
import com.gameteams.message.MessageDtos.SendMessageRequest;

import jakarta.validation.Valid;

/**
 * Mesaj gecmisi ve duzenleme/silme REST uzerinden; canli yayin STOMP ile.
 * Gonderme hem REST hem STOMP ile yapilabilir - REST, WebSocket kurulamayan
 * ortamlar icin yedek yoldur.
 */
@RestController
public class MessageController {

    private final MessageService messageService;
    private final SimpMessagingTemplate broker;

    MessageController(MessageService messageService, SimpMessagingTemplate broker) {
        this.messageService = messageService;
        this.broker = broker;
    }

    @GetMapping("/api/channels/{channelId}/messages")
    MessagePage history(@AuthenticationPrincipal AuthenticatedUser me,
            @PathVariable UUID channelId,
            @RequestParam(required = false) String cursor) {
        return messageService.history(channelId, me.id(), cursor);
    }

    @PostMapping("/api/channels/{channelId}/messages")
    MessageResponse send(@AuthenticationPrincipal AuthenticatedUser me,
            @PathVariable UUID channelId,
            @Valid @RequestBody SendMessageRequest request) {
        MessageResponse message = messageService.send(channelId, me.id(), request.content(),
                request.replyToId());
        broadcast(channelId, ChannelEvent.created(message));
        return message;
    }

    @PatchMapping("/api/messages/{messageId}")
    MessageResponse edit(@AuthenticationPrincipal AuthenticatedUser me,
            @PathVariable UUID messageId,
            @Valid @RequestBody EditMessageRequest request) {
        MessageResponse message = messageService.edit(messageId, me.id(), request.content());
        broadcast(message.channelId(), ChannelEvent.edited(message));
        return message;
    }

    @DeleteMapping("/api/messages/{messageId}")
    MessageResponse delete(@AuthenticationPrincipal AuthenticatedUser me,
            @PathVariable UUID messageId) {
        MessageResponse message = messageService.delete(messageId, me.id());
        broadcast(message.channelId(), ChannelEvent.deleted(message));
        return message;
    }

    private void broadcast(UUID channelId, ChannelEvent event) {
        broker.convertAndSend("/topic/channel." + channelId, event);
    }
}
