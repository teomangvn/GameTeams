package com.gameteams.admin;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.gameteams.user.Role;
import com.gameteams.user.User;

import jakarta.validation.constraints.Size;

public final class AdminDtos {

    private AdminDtos() {
    }

    public record AdminUserSummary(
            UUID id,
            String username,
            String displayName,
            String email,
            Role role,
            boolean emailVerified,
            boolean disabled,
            String disabledReason,
            Instant createdAt,
            Instant lastSeenAt) {

        static AdminUserSummary from(User user) {
            return new AdminUserSummary(
                    user.getId(), user.getUsername(), user.getDisplayName(), user.getEmail(),
                    user.getRole(), user.isEmailVerified(), user.isDisabled(),
                    user.getDisabledReason(), user.getCreatedAt(), user.getLastSeenAt());
        }
    }

    public record UserPage(List<AdminUserSummary> users, int page, int size, long total) {
    }

    public record DisableUserRequest(
            @Size(max = 200, message = "Gerekce en fazla 200 karakter olabilir.")
            String reason) {
    }

    public record AdminRoomSummary(
            UUID id,
            String name,
            String slug,
            String ownerUsername,
            boolean isPublic,
            boolean isTemporary,
            long memberCount,
            Instant createdAt) {
    }

    public record Stats(
            long totalUsers,
            long verifiedUsers,
            long disabledUsers,
            long totalRooms,
            long temporaryRooms,
            long totalMessages,
            long queuedTickets) {
    }
}
