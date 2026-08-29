package com.gameteams.matchmaking;

import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.gameteams.auth.AuthenticatedUser;
import com.gameteams.matchmaking.MatchmakingDtos.GameProfileRequest;
import com.gameteams.matchmaking.MatchmakingDtos.GameProfileResponse;
import com.gameteams.matchmaking.MatchmakingDtos.GameSummary;
import com.gameteams.matchmaking.MatchmakingDtos.JoinQueueRequest;
import com.gameteams.matchmaking.MatchmakingDtos.TicketResponse;

import jakarta.validation.Valid;

@RestController
public class MatchmakingController {

    private final MatchmakingService matchmaking;

    MatchmakingController(MatchmakingService matchmaking) {
        this.matchmaking = matchmaking;
    }

    @GetMapping("/api/games")
    List<GameSummary> games() {
        return matchmaking.listGames();
    }

    @GetMapping("/api/me/game-profiles")
    List<GameProfileResponse> profiles(@AuthenticationPrincipal AuthenticatedUser me) {
        return matchmaking.listProfiles(me.id());
    }

    @PutMapping("/api/me/game-profiles/{gameId}")
    GameProfileResponse upsertProfile(@AuthenticationPrincipal AuthenticatedUser me,
            @PathVariable UUID gameId, @Valid @RequestBody GameProfileRequest request) {
        return matchmaking.upsertProfile(me.id(), gameId, request);
    }

    @GetMapping("/api/matchmaking/ticket")
    ResponseEntity<TicketResponse> currentTicket(@AuthenticationPrincipal AuthenticatedUser me) {
        TicketResponse ticket = matchmaking.currentTicket(me.id());
        // Kuyrukta degilse 404 degil bos govde: istemci icin normal bir durum.
        return ticket == null ? ResponseEntity.noContent().build() : ResponseEntity.ok(ticket);
    }

    @PostMapping("/api/matchmaking/queue")
    TicketResponse joinQueue(@AuthenticationPrincipal AuthenticatedUser me,
            @Valid @RequestBody JoinQueueRequest request) {
        return matchmaking.joinQueue(me.id(), request);
    }

    @DeleteMapping("/api/matchmaking/queue")
    ResponseEntity<Void> leaveQueue(@AuthenticationPrincipal AuthenticatedUser me) {
        matchmaking.leaveQueue(me.id());
        return ResponseEntity.noContent().build();
    }
}
