package com.gameteams.friend;

import java.time.Instant;
import java.util.UUID;

import jakarta.validation.constraints.NotBlank;

public final class FriendDtos {

    private FriendDtos() {
    }

    /** Kullanici adiyla istek gonderilir; e-posta paylasmak gerekmez. */
    public record AddFriendRequest(@NotBlank(message = "Kullanici adi zorunlu.") String username) {
    }

    public record FriendSummary(
            UUID userId,
            String username,
            String displayName,
            String avatarUrl,
            boolean online,
            Instant since) {
    }

    public record FriendRequestSummary(
            UUID friendshipId,
            UUID userId,
            String username,
            String displayName,
            String avatarUrl,
            Instant createdAt) {
    }

    /** Arkadaslik olaylari /user/queue/friends uzerinden yayinlanir. */
    public record FriendEvent(String type, UUID friendshipId, FriendSummary user) {

        public static FriendEvent requestReceived(UUID friendshipId, FriendSummary user) {
            return new FriendEvent("FRIEND_REQUEST", friendshipId, user);
        }

        public static FriendEvent accepted(UUID friendshipId, FriendSummary user) {
            return new FriendEvent("FRIEND_ACCEPTED", friendshipId, user);
        }

        public static FriendEvent removed(UUID friendshipId, FriendSummary user) {
            return new FriendEvent("FRIEND_REMOVED", friendshipId, user);
        }
    }
}
