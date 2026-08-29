package com.gameteams.dm;

import java.time.Instant;
import java.util.UUID;

import com.gameteams.message.MessageDtos.MessageResponse;

import jakarta.validation.constraints.NotNull;

public final class DmDtos {

    private DmDtos() {
    }

    public record OpenConversationRequest(@NotNull(message = "Kullanici id zorunlu.") UUID userId) {
    }

    public record ConversationSummary(
            UUID id,
            UUID otherUserId,
            String otherUsername,
            String otherDisplayName,
            String otherAvatarUrl,
            boolean otherOnline,
            /** Listede onizleme icin; hic mesaj yoksa null. */
            MessageResponse lastMessage,
            Instant createdAt) {
    }
}
