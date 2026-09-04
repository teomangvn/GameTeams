package com.gameteams.message;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class MessageDtos {

    private MessageDtos() {
    }

    public record SendMessageRequest(
            @NotBlank(message = "Mesaj bos olamaz.")
            @Size(max = 4000, message = "Mesaj en fazla 4000 karakter olabilir.")
            String content,

            /** Yanitlanan mesajin id'si; yoksa null. */
            UUID replyToId) {
    }

    public record EditMessageRequest(
            @NotBlank(message = "Mesaj bos olamaz.")
            @Size(max = 4000, message = "Mesaj en fazla 4000 karakter olabilir.")
            String content) {
    }

    public record AuthorSummary(UUID id, String username, String displayName, String avatarUrl) {
    }

    public record MessageResponse(
            UUID id,
            /** Kanal mesajiysa dolu. */
            UUID channelId,
            /** DM ise dolu. */
            UUID conversationId,
            AuthorSummary author,
            String content,
            UUID replyToId,
            boolean deleted,
            Instant createdAt,
            Instant editedAt,
            AttachmentSummary attachment) {

        public static MessageResponse from(Message message) {
            var author = message.getAuthor();
            return new MessageResponse(
                    message.getId(),
                    message.getChannel() != null ? message.getChannel().getId() : null,
                    message.getConversation() != null ? message.getConversation().getId() : null,
                    new AuthorSummary(author.getId(), author.getUsername(),
                            author.getDisplayName(), author.getAvatarUrl()),
                    message.getContent(),
                    message.getReplyTo() != null ? message.getReplyTo().getId() : null,
                    message.isDeleted(),
                    message.getCreatedAt(),
                    message.getEditedAt(),
                    AttachmentSummary.from(message.getAttachment()));
        }
    }

    /**
     * Mesaj ekinin ozeti. url tahmin edilemez bir ad tasir; erisim kontrolu
     * buna dayanir (bkz. AttachmentStorage).
     */
    public record AttachmentSummary(
            UUID id,
            String fileName,
            String contentType,
            long sizeBytes,
            String url) {

        static AttachmentSummary from(MessageAttachment attachment) {
            if (attachment == null) {
                return null;
            }
            return new AttachmentSummary(
                    attachment.getId(),
                    attachment.getFileName(),
                    attachment.getContentType(),
                    attachment.getSizeBytes(),
                    "/api/attachments/" + attachment.getStoredName());
        }
    }

    /**
     * Keyset sayfasi. nextCursor bir sonraki (daha eski) sayfayi getirmek icin
     * kullanilir; null ise geriye mesaj kalmamistir.
     */
    public record MessagePage(List<MessageResponse> messages, String nextCursor) {
    }

    /** WebSocket uzerinden yayinlanan olaylar. */
    public record ChannelEvent(String type, MessageResponse message) {

        public static ChannelEvent created(MessageResponse m) {
            return new ChannelEvent("MESSAGE_CREATED", m);
        }

        public static ChannelEvent edited(MessageResponse m) {
            return new ChannelEvent("MESSAGE_EDITED", m);
        }

        public static ChannelEvent deleted(MessageResponse m) {
            return new ChannelEvent("MESSAGE_DELETED", m);
        }
    }

    public record TypingEvent(String type, UUID channelId, UUID userId, String displayName) {

        public static TypingEvent of(UUID channelId, UUID userId, String displayName) {
            return new TypingEvent("TYPING", channelId, userId, displayName);
        }
    }
}
