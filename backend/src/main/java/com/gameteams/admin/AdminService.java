package com.gameteams.admin;

import java.util.List;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.gameteams.admin.AdminDtos.AdminRoomSummary;
import com.gameteams.admin.AdminDtos.AdminUserSummary;
import com.gameteams.admin.AdminDtos.Stats;
import com.gameteams.admin.AdminDtos.UserPage;
import com.gameteams.auth.RefreshTokenRepository;
import com.gameteams.common.ApiException;
import com.gameteams.message.MessageRepository;
import com.gameteams.room.RoomMemberRepository;
import com.gameteams.room.RoomRepository;
import com.gameteams.user.Role;
import com.gameteams.user.User;
import com.gameteams.user.UserRepository;

@Service
public class AdminService {

    private static final Logger log = LoggerFactory.getLogger(AdminService.class);
    private static final int MAX_PAGE_SIZE = 100;

    private final UserRepository users;
    private final RoomRepository rooms;
    private final RoomMemberRepository roomMembers;
    private final MessageRepository messages;
    private final RefreshTokenRepository refreshTokens;

    AdminService(UserRepository users, RoomRepository rooms, RoomMemberRepository roomMembers,
            MessageRepository messages, RefreshTokenRepository refreshTokens) {
        this.users = users;
        this.rooms = rooms;
        this.roomMembers = roomMembers;
        this.messages = messages;
        this.refreshTokens = refreshTokens;
    }

    @Transactional(readOnly = true)
    public UserPage listUsers(String query, int page, int size) {
        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        var pageable = PageRequest.of(Math.max(page, 0), safeSize,
                Sort.by(Sort.Direction.DESC, "createdAt"));

        Page<User> result = (query == null || query.isBlank())
                ? users.findAll(pageable)
                : users.search(query.trim(), pageable);

        return new UserPage(
                result.getContent().stream().map(AdminUserSummary::from).toList(),
                result.getNumber(), result.getSize(), result.getTotalElements());
    }

    /**
     * Hesabi devre disi birakir ve tum oturumlarini kapatir.
     *
     * Yalnizca isaretlemek yetmez: elindeki refresh token ile 30 gun daha
     * oturum acabilirdi.
     */
    @Transactional
    public AdminUserSummary disableUser(UUID targetId, UUID adminId, String reason) {
        User target = users.findById(targetId)
                .orElseThrow(() -> ApiException.notFound("USER_NOT_FOUND", "Kullanici bulunamadi."));

        if (target.getId().equals(adminId)) {
            throw ApiException.badRequest("CANNOT_DISABLE_SELF",
                    "Kendi hesabini devre disi birakamazsin.");
        }
        // Son admin kilitlenirse sistemi yonetecek kimse kalmaz.
        if (target.getRole() == Role.ADMIN) {
            throw ApiException.badRequest("CANNOT_DISABLE_ADMIN",
                    "Yonetici hesaplari devre disi birakilamaz.");
        }

        target.disable(reason);
        refreshTokens.revokeAllForUser(target, java.time.Instant.now());

        log.info("Hesap devre disi birakildi: {} (yonetici: {})", target.getUsername(), adminId);
        return AdminUserSummary.from(target);
    }

    @Transactional
    public AdminUserSummary enableUser(UUID targetId) {
        User target = users.findById(targetId)
                .orElseThrow(() -> ApiException.notFound("USER_NOT_FOUND", "Kullanici bulunamadi."));
        target.enable();
        return AdminUserSummary.from(target);
    }

    @Transactional(readOnly = true)
    public List<AdminRoomSummary> listRooms() {
        return rooms.findAll(Sort.by(Sort.Direction.DESC, "createdAt")).stream()
                .map(room -> new AdminRoomSummary(
                        room.getId(), room.getName(), room.getSlug(),
                        room.getOwner().getUsername(), room.isPublic(), room.isTemporary(),
                        roomMembers.countByRoomId(room.getId()), room.getCreatedAt()))
                .toList();
    }

    @Transactional
    public void deleteRoom(UUID roomId) {
        rooms.findById(roomId).ifPresentOrElse(rooms::delete, () -> {
            throw ApiException.notFound("ROOM_NOT_FOUND", "Oda bulunamadi.");
        });
    }

    @Transactional(readOnly = true)
    public Stats stats() {
        return new Stats(
                users.count(),
                users.countByEmailVerifiedTrue(),
                users.countByDisabledAtIsNotNull(),
                rooms.count(),
                rooms.countByTemporaryTrue(),
                messages.count(),
                0L);
    }
}
