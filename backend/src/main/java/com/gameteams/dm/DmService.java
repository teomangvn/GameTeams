package com.gameteams.dm;

import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.gameteams.common.ApiException;
import com.gameteams.dm.DmDtos.ConversationSummary;
import com.gameteams.friend.FriendService;
import com.gameteams.message.MessageDtos.MessageResponse;
import com.gameteams.message.MessageRepository;
import com.gameteams.user.PresenceService;
import com.gameteams.user.User;
import com.gameteams.user.UserRepository;

@Service
public class DmService {

    private final DmConversationRepository conversations;
    private final MessageRepository messages;
    private final UserRepository users;
    private final FriendService friendService;
    private final PresenceService presence;

    DmService(DmConversationRepository conversations, MessageRepository messages,
            UserRepository users, FriendService friendService, PresenceService presence) {
        this.conversations = conversations;
        this.messages = messages;
        this.users = users;
        this.friendService = friendService;
        this.presence = presence;
    }

    /**
     * Sohbete erisim dogrular. Katilimci olmayana 404 doner: 403 sohbetin
     * varligini sizdirirdi.
     */
    @Transactional(readOnly = true)
    public DmConversation requireParticipant(UUID conversationId, UUID userId) {
        DmConversation conversation = conversations.findByIdWithUsers(conversationId)
                .orElseThrow(() -> ApiException.notFound("CONVERSATION_NOT_FOUND",
                        "Sohbet bulunamadi."));

        if (!conversation.includes(userId)) {
            throw ApiException.notFound("CONVERSATION_NOT_FOUND", "Sohbet bulunamadi.");
        }
        return conversation;
    }

    /**
     * Sohbeti acar; yoksa olusturur.
     *
     * Yalnizca arkadaslar birbirine DM atabilir -- aksi halde herhangi biri
     * herkese mesaj gonderebilir ve bu bir spam kanali olur.
     */
    @Transactional
    public ConversationSummary openWith(UUID userId, UUID otherUserId) {
        if (userId.equals(otherUserId)) {
            throw ApiException.badRequest("CANNOT_DM_SELF", "Kendinle sohbet acamazsin.");
        }
        if (!friendService.areFriends(userId, otherUserId)) {
            throw ApiException.forbidden("NOT_FRIENDS",
                    "Yalnizca arkadaslarinla ozel mesajlasabilirsin.");
        }

        User self = users.findById(userId)
                .orElseThrow(() -> ApiException.unauthorized("USER_NOT_FOUND", "Hesabin bulunamadi."));
        User other = users.findById(otherUserId)
                .orElseThrow(() -> ApiException.notFound("USER_NOT_FOUND", "Kullanici bulunamadi."));

        UUID smaller = userId.compareTo(otherUserId) < 0 ? userId : otherUserId;
        UUID larger = userId.compareTo(otherUserId) < 0 ? otherUserId : userId;

        DmConversation conversation = conversations.findByOrderedPair(smaller, larger)
                .orElseGet(() -> conversations.save(DmConversation.between(self, other)));

        return toSummary(conversation, userId);
    }

    @Transactional(readOnly = true)
    public List<ConversationSummary> listFor(UUID userId) {
        return conversations.findAllForUser(userId).stream()
                .map(conversation -> toSummary(conversation, userId))
                .toList();
    }

    private ConversationSummary toSummary(DmConversation conversation, UUID userId) {
        User other = conversation.otherThan(userId);

        MessageResponse last = messages
                .findLastInConversation(conversation.getId(), Limit.of(1)).stream()
                .findFirst()
                .map(MessageResponse::from)
                .orElse(null);

        return new ConversationSummary(
                conversation.getId(),
                other.getId(),
                other.getUsername(),
                other.getDisplayName(),
                other.getAvatarUrl(),
                presence.isOnline(other.getId()),
                last,
                conversation.getCreatedAt());
    }
}
