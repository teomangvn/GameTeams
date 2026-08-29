package com.gameteams.room;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.gameteams.channel.ChannelRepository;
import com.gameteams.common.ApiException;
import com.gameteams.user.User;
import com.gameteams.user.UserRepository;

/**
 * Erisim kurallari: uyelik ve sahiplik dogrulamasi.
 */
@ExtendWith(MockitoExtension.class)
class RoomServiceTest {

    @Mock
    private RoomRepository rooms;

    @Mock
    private RoomMemberRepository members;

    @Mock
    private ChannelRepository channels;

    @Mock
    private UserRepository users;

    @InjectMocks
    private RoomService roomService;

    private UUID roomId;
    private UUID userId;
    private Room room;
    private User user;

    @BeforeEach
    void setUp() {
        roomId = UUID.randomUUID();
        userId = UUID.randomUUID();
        user = new User("teoman", "Teoman", "teoman@example.com", "hash");
        room = new Room("Test Oda", "test-oda-abc123", null, user, false, "INVITE1234");
    }

    @Test
    void requireMemberReturnsMembershipWhenUserBelongsToRoom() {
        RoomMember membership = new RoomMember(room, user, RoomRole.MEMBER);
        when(members.findByRoomIdAndUserId(roomId, userId)).thenReturn(Optional.of(membership));

        assertThat(roomService.requireMember(roomId, userId)).isSameAs(membership);
    }

    /**
     * Uye olmayana 403 degil 404 donmeli: 403 "bu oda var ama giremezsin"
     * bilgisini sizdirirdi.
     */
    @Test
    void requireMemberHidesRoomExistenceFromNonMembers() {
        when(members.findByRoomIdAndUserId(roomId, userId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> roomService.requireMember(roomId, userId))
                .isInstanceOf(ApiException.class)
                .extracting(ex -> ((ApiException) ex).code())
                .isEqualTo("ROOM_NOT_FOUND");
    }

    @Test
    void requireOwnerRejectsPlainMember() {
        when(members.findByRoomIdAndUserId(roomId, userId))
                .thenReturn(Optional.of(new RoomMember(room, user, RoomRole.MEMBER)));

        assertThatThrownBy(() -> roomService.requireOwner(roomId, userId))
                .isInstanceOf(ApiException.class)
                .extracting(ex -> ((ApiException) ex).code())
                .isEqualTo("NOT_ROOM_OWNER");
    }

    @Test
    void requireOwnerAcceptsOwner() {
        RoomMember owner = new RoomMember(room, user, RoomRole.OWNER);
        when(members.findByRoomIdAndUserId(roomId, userId)).thenReturn(Optional.of(owner));

        assertThat(roomService.requireOwner(roomId, userId).isOwner()).isTrue();
    }

    @Test
    void leaveIsRejectedForOwnerSoRoomNeverBecomesOwnerless() {
        when(members.findByRoomIdAndUserId(roomId, userId))
                .thenReturn(Optional.of(new RoomMember(room, user, RoomRole.OWNER)));

        assertThatThrownBy(() -> roomService.leave(roomId, userId))
                .isInstanceOf(ApiException.class)
                .extracting(ex -> ((ApiException) ex).code())
                .isEqualTo("OWNER_CANNOT_LEAVE");
    }

    @Test
    void joinRejectsUnknownInviteCode() {
        when(rooms.findByInviteCode("YANLIS")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> roomService.joinByInviteCode(userId, "YANLIS"))
                .isInstanceOf(ApiException.class)
                .extracting(ex -> ((ApiException) ex).code())
                .isEqualTo("INVALID_INVITE");
    }

    @Test
    void joinRejectsDuplicateMembership() {
        when(rooms.findByInviteCode("INVITE1234")).thenReturn(Optional.of(room));
        when(members.existsByRoomIdAndUserId(room.getId(), userId)).thenReturn(true);

        assertThatThrownBy(() -> roomService.joinByInviteCode(userId, "INVITE1234"))
                .isInstanceOf(ApiException.class)
                .extracting(ex -> ((ApiException) ex).code())
                .isEqualTo("ALREADY_MEMBER");
    }

    @Test
    void ownerCannotKickThemselves() {
        when(members.findByRoomIdAndUserId(roomId, userId))
                .thenReturn(Optional.of(new RoomMember(room, user, RoomRole.OWNER)));

        assertThatThrownBy(() -> roomService.removeMember(roomId, userId, userId))
                .isInstanceOf(ApiException.class)
                .extracting(ex -> ((ApiException) ex).code())
                .isEqualTo("CANNOT_KICK_SELF");
    }
}
