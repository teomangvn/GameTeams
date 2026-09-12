package com.gameteams.block;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.gameteams.common.ApiException;
import com.gameteams.friend.FriendDtos.FriendEvent;
import com.gameteams.friend.FriendDtos.FriendSummary;
import com.gameteams.friend.FriendshipRepository;
import com.gameteams.user.User;
import com.gameteams.user.UserRepository;

/**
 * Engelleme.
 *
 * Engellenen kisi: arkadas listesinden cikar, arkadaslik istegi gonderemez,
 * mesaj atamaz, arayamaz. Engel iki yonlu uygulanir -- engelleyen de o kisiye
 * yazamaz; tek tarafli bir konusma engelin amacina ters dusurdu.
 *
 * Engellenen tarafa engellendigi soylenmez: arkadasliktan cikarilmis gibi
 * gorur, istekleri ve aramalari sessizce sonuc vermez.
 */
@Service
public class BlockService {

    private static final Logger log = LoggerFactory.getLogger(BlockService.class);

    private final UserBlockRepository blocks;
    private final FriendshipRepository friendships;
    private final UserRepository users;
    private final SimpMessagingTemplate broker;

    BlockService(UserBlockRepository blocks, FriendshipRepository friendships, UserRepository users,
            SimpMessagingTemplate broker) {
        this.blocks = blocks;
        this.friendships = friendships;
        this.users = users;
        this.broker = broker;
    }

    @Transactional
    public void block(UUID blockerId, UUID blockedId) {
        if (blockerId.equals(blockedId)) {
            throw ApiException.badRequest("CANNOT_BLOCK_SELF", "Kendini engelleyemezsin.");
        }
        User blocked = users.findById(blockedId)
                .orElseThrow(() -> ApiException.notFound("USER_NOT_FOUND", "Kullanici bulunamadi."));
        if (blocks.hasBlocked(blockerId, blockedId)) {
            return;
        }
        User blocker = users.findById(blockerId)
                .orElseThrow(() -> ApiException.unauthorized("USER_NOT_FOUND", "Hesabin bulunamadi."));

        // Arkadaslik veya bekleyen istek kalkar. Karsi tarafa "arkadasliktan
        // cikarildi" olayi gider ki listesi tazelensin; engel ayrica duyurulmaz.
        friendships.findBetween(blockerId, blockedId).ifPresent(friendship -> {
            UUID friendshipId = friendship.getId();
            friendships.delete(friendship);
            broker.convertAndSendToUser(blockedId.toString(), "/queue/friends",
                    FriendEvent.removed(friendshipId, summary(blocker)));
        });

        blocks.save(new UserBlock(blocker, blocked));
        log.info("Engelleme: {} -> {}", blocker.getUsername(), blocked.getUsername());
    }

    @Transactional
    public void unblock(UUID blockerId, UUID blockedId) {
        // Arkadaslik geri gelmez; isteyen yeniden istek gonderir.
        blocks.find(blockerId, blockedId).ifPresent(blocks::delete);
    }

    @Transactional(readOnly = true)
    public List<BlockedUser> listBlocked(UUID blockerId) {
        return blocks.findAllByBlocker(blockerId).stream()
                .map(block -> {
                    User user = block.getBlocked();
                    return new BlockedUser(user.getId(), user.getUsername(), user.getDisplayName(),
                            user.getAvatarUrl(), block.getCreatedAt());
                })
                .toList();
    }

    /** Taraflardan biri digerini engellediyse iletisim yok. */
    @Transactional(readOnly = true)
    public boolean isBlockedEitherWay(UUID a, UUID b) {
        return blocks.existsEitherWay(a, b);
    }

    @Transactional(readOnly = true)
    public boolean hasBlocked(UUID blockerId, UUID blockedId) {
        return blocks.hasBlocked(blockerId, blockedId);
    }

    private static FriendSummary summary(User user) {
        return new FriendSummary(user.getId(), user.getUsername(), user.getDisplayName(),
                user.getAvatarUrl(), false, null);
    }

    public record BlockedUser(UUID userId, String username, String displayName, String avatarUrl,
            Instant blockedAt) {
    }
}
