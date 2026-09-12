package com.gameteams.block;

import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.gameteams.auth.AuthenticatedUser;
import com.gameteams.block.BlockService.BlockedUser;

@RestController
@RequestMapping("/api/blocks")
public class BlockController {

    private final BlockService blockService;

    BlockController(BlockService blockService) {
        this.blockService = blockService;
    }

    /** Engellediklerim. Beni kimin engelledigi bilerek sunulmaz. */
    @GetMapping
    List<BlockedUser> list(@AuthenticationPrincipal AuthenticatedUser me) {
        return blockService.listBlocked(me.id());
    }

    /** PUT: tekrar cagirmak zararsiz; zaten engelliyse bir sey degismez. */
    @PutMapping("/{userId}")
    ResponseEntity<Void> block(@AuthenticationPrincipal AuthenticatedUser me,
            @PathVariable UUID userId) {
        blockService.block(me.id(), userId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{userId}")
    ResponseEntity<Void> unblock(@AuthenticationPrincipal AuthenticatedUser me,
            @PathVariable UUID userId) {
        blockService.unblock(me.id(), userId);
        return ResponseEntity.noContent().build();
    }
}
