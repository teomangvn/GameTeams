package com.gameteams.friend;

import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.gameteams.auth.AuthenticatedUser;
import com.gameteams.friend.FriendDtos.AddFriendRequest;
import com.gameteams.friend.FriendDtos.FriendRequestSummary;
import com.gameteams.friend.FriendDtos.FriendSummary;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/friends")
public class FriendController {

    private final FriendService friendService;

    FriendController(FriendService friendService) {
        this.friendService = friendService;
    }

    @GetMapping
    List<FriendSummary> list(@AuthenticationPrincipal AuthenticatedUser me) {
        return friendService.listFriends(me.id());
    }

    @GetMapping("/requests/incoming")
    List<FriendRequestSummary> incoming(@AuthenticationPrincipal AuthenticatedUser me) {
        return friendService.listIncoming(me.id());
    }

    @GetMapping("/requests/outgoing")
    List<FriendRequestSummary> outgoing(@AuthenticationPrincipal AuthenticatedUser me) {
        return friendService.listOutgoing(me.id());
    }

    @PostMapping("/requests")
    FriendSummary sendRequest(@AuthenticationPrincipal AuthenticatedUser me,
            @Valid @RequestBody AddFriendRequest request) {
        return friendService.sendRequest(me.id(), request.username());
    }

    @PostMapping("/requests/{friendshipId}/accept")
    FriendSummary accept(@AuthenticationPrincipal AuthenticatedUser me,
            @PathVariable UUID friendshipId) {
        return friendService.accept(friendshipId, me.id());
    }

    @DeleteMapping("/requests/{friendshipId}")
    ResponseEntity<Void> decline(@AuthenticationPrincipal AuthenticatedUser me,
            @PathVariable UUID friendshipId) {
        friendService.decline(friendshipId, me.id());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{userId}")
    ResponseEntity<Void> remove(@AuthenticationPrincipal AuthenticatedUser me,
            @PathVariable UUID userId) {
        friendService.remove(userId, me.id());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{userId}/block")
    ResponseEntity<Void> block(@AuthenticationPrincipal AuthenticatedUser me,
            @PathVariable UUID userId) {
        friendService.block(userId, me.id());
        return ResponseEntity.noContent().build();
    }
}
