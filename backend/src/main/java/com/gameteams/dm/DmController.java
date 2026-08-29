package com.gameteams.dm;

import java.util.List;
import java.util.UUID;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.gameteams.auth.AuthenticatedUser;
import com.gameteams.dm.DmDtos.ConversationSummary;
import com.gameteams.dm.DmDtos.OpenConversationRequest;
import com.gameteams.message.MessageDtos.MessagePage;
import com.gameteams.message.MessageDtos.MessageResponse;
import com.gameteams.message.MessageDtos.SendMessageRequest;
import com.gameteams.message.MessageService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/conversations")
public class DmController {

    private final DmService dmService;
    private final MessageService messageService;
    private final SimpMessagingTemplate broker;

    DmController(DmService dmService, MessageService messageService,
            SimpMessagingTemplate broker) {
        this.dmService = dmService;
        this.messageService = messageService;
        this.broker = broker;
    }

    @GetMapping
    List<ConversationSummary> list(@AuthenticationPrincipal AuthenticatedUser me) {
        return dmService.listFor(me.id());
    }

    @PostMapping
    ConversationSummary open(@AuthenticationPrincipal AuthenticatedUser me,
            @Valid @RequestBody OpenConversationRequest request) {
        return dmService.openWith(me.id(), request.userId());
    }

    @GetMapping("/{conversationId}/messages")
    MessagePage history(@AuthenticationPrincipal AuthenticatedUser me,
            @PathVariable UUID conversationId,
            @RequestParam(required = false) String cursor) {
        return messageService.conversationHistory(conversationId, me.id(), cursor);
    }

    @PostMapping("/{conversationId}/messages")
    MessageResponse send(@AuthenticationPrincipal AuthenticatedUser me,
            @PathVariable UUID conversationId,
            @Valid @RequestBody SendMessageRequest request) {
        MessageResponse message = messageService.sendDirect(conversationId, me.id(),
                request.content(), request.replyToId());

        // DM'de kanal topic'i yok; her iki katilimciya ayri ayri gonderilir.
        var conversation = dmService.requireParticipant(conversationId, me.id());
        for (UUID participant : List.of(conversation.getUserA().getId(),
                conversation.getUserB().getId())) {
            broker.convertAndSendToUser(participant.toString(), "/queue/dm", message);
        }
        return message;
    }
}
