package com.gameteams.room;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.gameteams.channel.ChannelDtos.ChannelResponse;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class RoomDtos {

    private RoomDtos() {
    }

    public record CreateRoomRequest(
            @NotBlank(message = "Oda adi zorunlu.")
            @Size(min = 2, max = 64, message = "Oda adi 2-64 karakter olmali.")
            String name,

            @Size(max = 300, message = "Aciklama en fazla 300 karakter olabilir.")
            String description,

            boolean isPublic) {
    }

    public record UpdateRoomRequest(
            @Size(min = 2, max = 64, message = "Oda adi 2-64 karakter olmali.")
            String name,

            @Size(max = 300, message = "Aciklama en fazla 300 karakter olabilir.")
            String description,

            Boolean isPublic) {
    }

    public record JoinRoomRequest(@NotBlank(message = "Davet kodu zorunlu.") String inviteCode) {
    }

    /** Oda listesi icin ozet gorunum. */
    public record RoomSummary(
            UUID id,
            String name,
            String slug,
            String description,
            String iconUrl,
            boolean isPublic,
            boolean isTemporary,
            RoomRole myRole,
            long memberCount,
            Instant createdAt) {
    }

    /** Tek oda gorunumu: kanallar dahil. Davet kodu yalnizca sahibine gonderilir. */
    public record RoomDetail(
            UUID id,
            String name,
            String slug,
            String description,
            String iconUrl,
            boolean isPublic,
            boolean isTemporary,
            UUID ownerId,
            RoomRole myRole,
            String inviteCode,
            int maxMembers,
            long memberCount,
            List<ChannelResponse> channels,
            Instant createdAt) {
    }

    /**
     * /topic/room.{roomId} uzerinden yayinlanan olaylar: cevrimici durumu ve
     * uyelik degisiklikleri. ROOM_DELETED'da userId bostur.
     */
    public record RoomEvent(String type, UUID userId, boolean online) {

        public static RoomEvent presence(UUID userId, boolean online) {
            return new RoomEvent("PRESENCE_UPDATE", userId, online);
        }

        public static RoomEvent memberLeft(UUID userId) {
            return new RoomEvent("MEMBER_LEFT", userId, false);
        }

        public static RoomEvent memberRemoved(UUID userId) {
            return new RoomEvent("MEMBER_REMOVED", userId, false);
        }

        public static RoomEvent roomDeleted() {
            return new RoomEvent("ROOM_DELETED", null, false);
        }
    }

    /**
     * /user/queue/rooms: kullanicinin kendisini etkileyen oda degisikligi
     * (odadan cikarildi, oda silindi). Kullanici o odaya bakmasa da ulasir.
     */
    public record RoomNotice(String type, UUID roomId, String roomName) {
    }

    public record MemberResponse(
            UUID userId,
            String username,
            String displayName,
            String avatarUrl,
            String nickname,
            RoomRole role,
            Instant joinedAt,
            boolean online) {
    }
}
