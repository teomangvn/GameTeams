package com.gameteams.channel;

import java.util.List;
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
import org.springframework.web.bind.annotation.RestController;

import com.gameteams.auth.AuthenticatedUser;
import com.gameteams.channel.ChannelDtos.ChannelResponse;
import com.gameteams.channel.ChannelDtos.CreateChannelRequest;
import com.gameteams.channel.ChannelDtos.UpdateChannelRequest;

import jakarta.validation.Valid;

@RestController
public class ChannelController {

    private final ChannelService channelService;

    ChannelController(ChannelService channelService) {
        this.channelService = channelService;
    }

    @GetMapping("/api/rooms/{roomId}/channels")
    List<ChannelResponse> list(@AuthenticationPrincipal AuthenticatedUser me,
            @PathVariable UUID roomId) {
        return channelService.listByRoom(roomId, me.id());
    }

    @PostMapping("/api/rooms/{roomId}/channels")
    ResponseEntity<ChannelResponse> create(@AuthenticationPrincipal AuthenticatedUser me,
            @PathVariable UUID roomId, @Valid @RequestBody CreateChannelRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(channelService.create(roomId, me.id(), request));
    }

    @GetMapping("/api/channels/{channelId}")
    ChannelResponse get(@AuthenticationPrincipal AuthenticatedUser me,
            @PathVariable UUID channelId) {
        return ChannelResponse.from(channelService.requireAccessibleChannel(channelId, me.id()));
    }

    @PatchMapping("/api/channels/{channelId}")
    ChannelResponse update(@AuthenticationPrincipal AuthenticatedUser me,
            @PathVariable UUID channelId, @Valid @RequestBody UpdateChannelRequest request) {
        return channelService.update(channelId, me.id(), request);
    }

    @DeleteMapping("/api/channels/{channelId}")
    ResponseEntity<Void> delete(@AuthenticationPrincipal AuthenticatedUser me,
            @PathVariable UUID channelId) {
        channelService.delete(channelId, me.id());
        return ResponseEntity.noContent().build();
    }
}
