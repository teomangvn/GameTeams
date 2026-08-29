package com.gameteams.room;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.gameteams.auth.AuthenticatedUser;
import com.gameteams.room.RoomDtos.CreateRoomRequest;
import com.gameteams.room.RoomDtos.JoinRoomRequest;
import com.gameteams.room.RoomDtos.MemberResponse;
import com.gameteams.room.RoomDtos.RoomDetail;
import com.gameteams.room.RoomDtos.RoomSummary;
import com.gameteams.room.RoomDtos.UpdateRoomRequest;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/rooms")
public class RoomController {

    private final RoomService roomService;

    RoomController(RoomService roomService) {
        this.roomService = roomService;
    }

    @GetMapping
    List<RoomSummary> myRooms(@AuthenticationPrincipal AuthenticatedUser me) {
        return roomService.listMyRooms(me.id());
    }

    @PostMapping
    ResponseEntity<RoomDetail> create(@AuthenticationPrincipal AuthenticatedUser me,
            @Valid @RequestBody CreateRoomRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(roomService.create(me.id(), request));
    }

    @PostMapping("/join")
    RoomDetail join(@AuthenticationPrincipal AuthenticatedUser me,
            @Valid @RequestBody JoinRoomRequest request) {
        return roomService.joinByInviteCode(me.id(), request.inviteCode());
    }

    @GetMapping("/{roomId}")
    RoomDetail get(@AuthenticationPrincipal AuthenticatedUser me, @PathVariable UUID roomId) {
        return roomService.get(roomId, me.id());
    }

    @PatchMapping("/{roomId}")
    RoomDetail update(@AuthenticationPrincipal AuthenticatedUser me, @PathVariable UUID roomId,
            @Valid @RequestBody UpdateRoomRequest request) {
        return roomService.update(roomId, me.id(), request);
    }

    @DeleteMapping("/{roomId}")
    ResponseEntity<Void> delete(@AuthenticationPrincipal AuthenticatedUser me,
            @PathVariable UUID roomId) {
        roomService.delete(roomId, me.id());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{roomId}/leave")
    ResponseEntity<Void> leave(@AuthenticationPrincipal AuthenticatedUser me,
            @PathVariable UUID roomId) {
        roomService.leave(roomId, me.id());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{roomId}/members")
    List<MemberResponse> members(@AuthenticationPrincipal AuthenticatedUser me,
            @PathVariable UUID roomId) {
        return roomService.listMembers(roomId, me.id());
    }

    @DeleteMapping("/{roomId}/members/{userId}")
    ResponseEntity<Void> removeMember(@AuthenticationPrincipal AuthenticatedUser me,
            @PathVariable UUID roomId, @PathVariable UUID userId) {
        roomService.removeMember(roomId, me.id(), userId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{roomId}/invite-code")
    Map<String, String> regenerateInvite(@AuthenticationPrincipal AuthenticatedUser me,
            @PathVariable UUID roomId) {
        return Map.of("inviteCode", roomService.regenerateInviteCode(roomId, me.id()));
    }
}
