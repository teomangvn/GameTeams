package com.gameteams.room;

import java.text.Normalizer;
import java.util.Set;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.gameteams.auth.SecureTokens;
import com.gameteams.channel.Channel;
import com.gameteams.channel.ChannelDtos.ChannelResponse;
import com.gameteams.channel.ChannelRepository;
import com.gameteams.channel.ChannelType;
import com.gameteams.common.ApiException;
import com.gameteams.room.RoomDtos.CreateRoomRequest;
import com.gameteams.room.RoomDtos.MemberResponse;
import com.gameteams.room.RoomDtos.RoomDetail;
import com.gameteams.room.RoomDtos.RoomSummary;
import com.gameteams.room.RoomDtos.UpdateRoomRequest;
import com.gameteams.user.PresenceService;
import com.gameteams.user.User;
import com.gameteams.user.UserRepository;

@Service
public class RoomService {

    private static final Logger log = LoggerFactory.getLogger(RoomService.class);

    private static final int INVITE_CODE_LENGTH = 10;

    private final RoomRepository rooms;
    private final RoomMemberRepository members;
    private final ChannelRepository channels;
    private final UserRepository users;

    private final PresenceService presence;

    RoomService(RoomRepository rooms, RoomMemberRepository members, ChannelRepository channels,
            UserRepository users, PresenceService presence) {
        this.rooms = rooms;
        this.members = members;
        this.channels = channels;
        this.users = users;
        this.presence = presence;
    }

    /**
     * Uyelik dogrular. Uye olmayana 404 doner (403 degil): aksi halde bir odanin
     * var olup olmadigi disaridan anlasilabilirdi.
     */
    @Transactional(readOnly = true)
    public RoomMember requireMember(UUID roomId, UUID userId) {
        return members.findByRoomIdAndUserId(roomId, userId)
                .orElseThrow(() -> ApiException.notFound("ROOM_NOT_FOUND", "Oda bulunamadi."));
    }

    public RoomMember requireOwner(UUID roomId, UUID userId) {
        RoomMember member = requireMember(roomId, userId);
        if (!member.isOwner()) {
            throw ApiException.forbidden("NOT_ROOM_OWNER", "Bu islem icin oda sahibi olmalisin.");
        }
        return member;
    }

    @Transactional
    public RoomDetail create(UUID userId, CreateRoomRequest request) {
        User owner = users.findById(userId)
                .orElseThrow(() -> ApiException.unauthorized("USER_NOT_FOUND", "Hesabin bulunamadi."));

        Room room = new Room(
                request.name().trim(),
                generateSlug(request.name()),
                request.description(),
                owner,
                request.isPublic(),
                generateInviteCode());
        rooms.save(room);

        members.save(new RoomMember(room, owner, RoomRole.OWNER));

        // Bos oda kullanilamaz; bir metin ve bir ses kanaliyla acilir.
        channels.save(new Channel(room, "genel", ChannelType.TEXT, "Genel sohbet", 0, null));
        channels.save(new Channel(room, "Genel Sohbet", ChannelType.VOICE, null, 1, 6));

        log.info("Oda olusturuldu: {} ({})", room.getName(), room.getId());
        return detail(room, RoomRole.OWNER);
    }

    @Transactional(readOnly = true)
    public List<RoomSummary> listMyRooms(UUID userId) {
        User user = users.getReferenceById(userId);
        return members.findAllByUserWithRoom(user).stream()
                .map(member -> {
                    Room room = member.getRoom();
                    return new RoomSummary(
                            room.getId(),
                            room.getName(),
                            room.getSlug(),
                            room.getDescription(),
                            room.getIconUrl(),
                            room.isPublic(),
                            room.isTemporary(),
                            member.getRole(),
                            members.countByRoomId(room.getId()),
                            room.getCreatedAt());
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public RoomDetail get(UUID roomId, UUID userId) {
        RoomMember member = requireMember(roomId, userId);
        return detail(member.getRoom(), member.getRole());
    }

    @Transactional
    public RoomDetail update(UUID roomId, UUID userId, UpdateRoomRequest request) {
        RoomMember member = requireOwner(roomId, userId);
        Room room = member.getRoom();

        if (request.name() != null) {
            room.setName(request.name().trim());
        }
        if (request.description() != null) {
            room.setDescription(request.description());
        }
        if (request.isPublic() != null) {
            room.setPublic(request.isPublic());
        }
        return detail(room, member.getRole());
    }

    @Transactional
    public void delete(UUID roomId, UUID userId) {
        RoomMember member = requireOwner(roomId, userId);
        // Uyeler ve kanallar FK uzerindeki ON DELETE CASCADE ile birlikte gider.
        rooms.delete(member.getRoom());
        log.info("Oda silindi: {}", roomId);
    }

    @Transactional
    public RoomDetail joinByInviteCode(UUID userId, String inviteCode) {
        Room room = rooms.findByInviteCode(inviteCode.trim())
                .orElseThrow(() -> ApiException.notFound("INVALID_INVITE", "Davet kodu gecersiz."));

        if (members.existsByRoomIdAndUserId(room.getId(), userId)) {
            throw ApiException.conflict("ALREADY_MEMBER", "Bu odanin zaten uyesisin.");
        }
        if (members.countByRoomId(room.getId()) >= room.getMaxMembers()) {
            throw ApiException.conflict("ROOM_FULL", "Oda dolu.");
        }

        User user = users.findById(userId)
                .orElseThrow(() -> ApiException.unauthorized("USER_NOT_FOUND", "Hesabin bulunamadi."));
        members.save(new RoomMember(room, user, RoomRole.MEMBER));

        return detail(room, RoomRole.MEMBER);
    }

    @Transactional
    public void leave(UUID roomId, UUID userId) {
        RoomMember member = requireMember(roomId, userId);
        if (member.isOwner()) {
            throw ApiException.badRequest("OWNER_CANNOT_LEAVE",
                    "Oda sahibi ayrilamaz. Odayi silebilirsin.");
        }
        members.delete(member);
    }

    @Transactional(readOnly = true)
    public List<MemberResponse> listMembers(UUID roomId, UUID userId) {
        requireMember(roomId, userId);
        List<RoomMember> found = members.findAllByRoomIdWithUser(roomId);

        // Tek Redis turunda hepsini sor: uye basina sorgu atmak kalabalik
        // odalarda liste acilisini gereksiz yere yavaslatirdi.
        Set<UUID> online = presence.onlineAmong(
                found.stream().map(member -> member.getUser().getId()).toList());

        return found.stream()
                .map(member -> {
                    User user = member.getUser();
                    return new MemberResponse(
                            user.getId(),
                            user.getUsername(),
                            user.getDisplayName(),
                            user.getAvatarUrl(),
                            member.getNickname(),
                            member.getRole(),
                            member.getJoinedAt(),
                            online.contains(user.getId()));
                })
                .toList();
    }

    @Transactional
    public void removeMember(UUID roomId, UUID ownerId, UUID targetUserId) {
        requireOwner(roomId, ownerId);
        if (ownerId.equals(targetUserId)) {
            throw ApiException.badRequest("CANNOT_KICK_SELF", "Kendini odadan atamazsin.");
        }
        RoomMember target = members.findByRoomIdAndUserId(roomId, targetUserId)
                .orElseThrow(() -> ApiException.notFound("NOT_A_MEMBER", "Kullanici bu odada degil."));
        members.delete(target);
    }

    /** Davet kodunu yeniler; eski kod aninda gecersiz olur. */
    @Transactional
    public String regenerateInviteCode(UUID roomId, UUID userId) {
        RoomMember member = requireOwner(roomId, userId);
        String code = generateInviteCode();
        member.getRoom().setInviteCode(code);
        return code;
    }

    private RoomDetail detail(Room room, RoomRole myRole) {
        List<ChannelResponse> channelList =
                channels.findAllByRoomIdOrderByPositionAscCreatedAtAsc(room.getId()).stream()
                        .map(ChannelResponse::from)
                        .toList();

        return new RoomDetail(
                room.getId(),
                room.getName(),
                room.getSlug(),
                room.getDescription(),
                room.getIconUrl(),
                room.isPublic(),
                room.isTemporary(),
                room.getOwner().getId(),
                myRole,
                // Davet kodu paylasilan tek erisim anahtari; sadece sahibi gorur.
                myRole == RoomRole.OWNER ? room.getInviteCode() : null,
                room.getMaxMembers(),
                members.countByRoomId(room.getId()),
                channelList,
                room.getCreatedAt());
    }

    private String generateInviteCode() {
        String code;
        do {
            code = SecureTokens.generate().substring(0, INVITE_CODE_LENGTH);
        }
        while (rooms.findByInviteCode(code).isPresent());
        return code;
    }

    /**
     * URL uyumlu slug uretir. Aksanli harfler NFD ile ayristirilip birlesim
     * isaretleri atilir, boylece "Oyuncular" ile "Oyuncülar" ayni tabani verir.
     * Sonuna kisa rastgele ek konur ki ayni isimli odalar catismasin.
     */
    private String generateSlug(String name) {
        String decomposed = Normalizer.normalize(name.trim().toLowerCase(Locale.ROOT),
                Normalizer.Form.NFD);

        StringBuilder builder = new StringBuilder(decomposed.length());
        boolean lastWasDash = true;
        for (int i = 0; i < decomposed.length(); i++) {
            char ch = decomposed.charAt(i);
            if (Character.getType(ch) == Character.NON_SPACING_MARK) {
                continue;
            }
            if ((ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9')) {
                builder.append(ch);
                lastWasDash = false;
            }
            else if (!lastWasDash) {
                builder.append('-');
                lastWasDash = true;
            }
        }

        String base = builder.toString();
        if (base.endsWith("-")) {
            base = base.substring(0, base.length() - 1);
        }
        if (base.isEmpty()) {
            base = "oda";
        }
        if (base.length() > 60) {
            base = base.substring(0, 60);
        }

        String slug;
        do {
            slug = base + "-" + SecureTokens.generate().substring(0, 6).toLowerCase(Locale.ROOT);
        }
        while (rooms.existsBySlug(slug));
        return slug;
    }
}
