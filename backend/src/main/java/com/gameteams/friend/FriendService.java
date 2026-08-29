package com.gameteams.friend;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.gameteams.common.ApiException;
import com.gameteams.friend.FriendDtos.FriendEvent;
import com.gameteams.friend.FriendDtos.FriendRequestSummary;
import com.gameteams.friend.FriendDtos.FriendSummary;
import com.gameteams.user.PresenceService;
import com.gameteams.user.User;
import com.gameteams.user.UserRepository;

@Service
public class FriendService {

    private static final Logger log = LoggerFactory.getLogger(FriendService.class);

    private final FriendshipRepository friendships;
    private final UserRepository users;
    private final PresenceService presence;
    private final SimpMessagingTemplate broker;

    FriendService(FriendshipRepository friendships, UserRepository users,
            PresenceService presence, SimpMessagingTemplate broker) {
        this.friendships = friendships;
        this.users = users;
        this.presence = presence;
        this.broker = broker;
    }

    /**
     * Kullanici adiyla arkadaslik istegi gonderir.
     *
     * Karsi taraf zaten bize istek gonderdiyse yeni kayit acmak yerine mevcut
     * istegi kabul ederiz; aksi halde iki yonlu bekleyen istek olusur ve ikisi
     * de "kabul et" butonuna basmayi beklerdi.
     */
    @Transactional
    public FriendSummary sendRequest(UUID requesterId, String username) {
        User addressee = users.findByUsernameIgnoreCase(username.trim())
                .orElseThrow(() -> ApiException.notFound("USER_NOT_FOUND",
                        "Bu kullanici adiyla kimse bulunamadi."));

        if (addressee.getId().equals(requesterId)) {
            throw ApiException.badRequest("CANNOT_ADD_SELF", "Kendini ekleyemezsin.");
        }

        var existing = friendships.findBetween(requesterId, addressee.getId());
        if (existing.isPresent()) {
            Friendship friendship = existing.get();

            if (friendship.getStatus() == FriendshipStatus.BLOCKED) {
                // Engelin varligini sizdirmamak icin istek gonderilmis gibi
                // normal yanit doner.
                return toSummary(addressee, friendship.getCreatedAt());
            }
            if (friendship.isAccepted()) {
                throw ApiException.conflict("ALREADY_FRIENDS", "Zaten arkadassiniz.");
            }
            if (friendship.getAddressee().getId().equals(requesterId)) {
                return accept(friendship.getId(), requesterId);
            }
            throw ApiException.conflict("REQUEST_PENDING", "Istek zaten gonderilmis.");
        }

        User requester = users.findById(requesterId)
                .orElseThrow(() -> ApiException.unauthorized("USER_NOT_FOUND", "Hesabin bulunamadi."));

        Friendship friendship = friendships.save(new Friendship(requester, addressee));
        notify(addressee.getId(), FriendEvent.requestReceived(
                friendship.getId(), toSummary(requester, friendship.getCreatedAt())));

        log.debug("Arkadaslik istegi: {} -> {}", requester.getUsername(), addressee.getUsername());
        return toSummary(addressee, friendship.getCreatedAt());
    }

    @Transactional
    public FriendSummary accept(UUID friendshipId, UUID userId) {
        Friendship friendship = requirePendingForAddressee(friendshipId, userId);
        friendship.accept();

        User requester = friendship.getRequester();
        notify(requester.getId(), FriendEvent.accepted(friendship.getId(),
                toSummary(friendship.getAddressee(), friendship.getRespondedAt())));

        return toSummary(requester, friendship.getRespondedAt());
    }

    @Transactional
    public void decline(UUID friendshipId, UUID userId) {
        friendships.delete(requirePendingForAddressee(friendshipId, userId));
    }

    /** Arkadasligi sonlandirir veya gonderilmis istegi geri ceker. */
    @Transactional
    public void remove(UUID otherUserId, UUID userId) {
        Friendship friendship = friendships.findBetween(userId, otherUserId)
                .orElseThrow(() -> ApiException.notFound("NOT_FRIENDS", "Boyle bir iliski yok."));

        UUID friendshipId = friendship.getId();
        User other = friendship.otherThan(userId);
        User self = friendship.otherThan(other.getId());
        friendships.delete(friendship);

        notify(other.getId(), FriendEvent.removed(friendshipId, toSummary(self, null)));
    }

    @Transactional
    public void block(UUID otherUserId, UUID userId) {
        Friendship friendship = friendships.findBetween(userId, otherUserId)
                .orElseGet(() -> friendships.save(new Friendship(
                        users.getReferenceById(userId), users.getReferenceById(otherUserId))));
        friendship.block();
    }

    @Transactional(readOnly = true)
    public List<FriendSummary> listFriends(UUID userId) {
        List<Friendship> accepted = friendships.findAcceptedFor(userId);

        // Cevrimici durumu tek seferde sorulur; her arkadas icin ayri Redis
        // cagrisi liste buyudukce pahaliya patlar.
        Set<UUID> online = presence.onlineAmong(
                accepted.stream().map(f -> f.otherThan(userId).getId()).toList());

        return accepted.stream()
                .map(f -> {
                    User other = f.otherThan(userId);
                    return new FriendSummary(other.getId(), other.getUsername(),
                            other.getDisplayName(), other.getAvatarUrl(),
                            online.contains(other.getId()), f.getRespondedAt());
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public List<FriendRequestSummary> listIncoming(UUID userId) {
        return friendships.findIncomingRequests(userId).stream()
                .map(f -> toRequestSummary(f, f.getRequester()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<FriendRequestSummary> listOutgoing(UUID userId) {
        return friendships.findOutgoingRequests(userId).stream()
                .map(f -> toRequestSummary(f, f.getAddressee()))
                .toList();
    }

    @Transactional(readOnly = true)
    public boolean areFriends(UUID a, UUID b) {
        return friendships.findBetween(a, b).filter(Friendship::isAccepted).isPresent();
    }

    private Friendship requirePendingForAddressee(UUID friendshipId, UUID userId) {
        Friendship friendship = friendships.findById(friendshipId)
                .orElseThrow(() -> ApiException.notFound("REQUEST_NOT_FOUND", "Istek bulunamadi."));

        // Yalnizca istegin gonderildigi kisi yanitlayabilir. Baskasinin istegini
        // gormemesi icin 403 degil 404 doner.
        if (!friendship.getAddressee().getId().equals(userId)
                || friendship.getStatus() != FriendshipStatus.PENDING) {
            throw ApiException.notFound("REQUEST_NOT_FOUND", "Istek bulunamadi.");
        }
        return friendship;
    }

    private FriendSummary toSummary(User user, Instant since) {
        return new FriendSummary(user.getId(), user.getUsername(), user.getDisplayName(),
                user.getAvatarUrl(), presence.isOnline(user.getId()), since);
    }

    private FriendRequestSummary toRequestSummary(Friendship friendship, User other) {
        return new FriendRequestSummary(friendship.getId(), other.getId(), other.getUsername(),
                other.getDisplayName(), other.getAvatarUrl(), friendship.getCreatedAt());
    }

    private void notify(UUID userId, FriendEvent event) {
        broker.convertAndSendToUser(userId.toString(), "/queue/friends", event);
    }
}
