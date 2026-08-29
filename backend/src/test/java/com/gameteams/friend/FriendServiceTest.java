package com.gameteams.friend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import com.gameteams.common.ApiException;
import com.gameteams.user.PresenceService;
import com.gameteams.user.User;
import com.gameteams.user.UserRepository;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class FriendServiceTest {

    @Mock
    private FriendshipRepository friendships;

    @Mock
    private UserRepository users;

    @Mock
    private PresenceService presence;

    @Mock
    private SimpMessagingTemplate broker;

    @InjectMocks
    private FriendService friendService;

    private User alice;
    private User bob;

    @BeforeEach
    void setUp() {
        alice = user("alice", "Alice");
        bob = user("bob", "Bob");
    }

    private static User user(String username, String displayName) {
        User user = new User(username, displayName, username + "@example.com", "hash");
        ReflectionTestUtils.setField(user, "id", UUID.randomUUID());
        return user;
    }

    @Test
    void cannotAddSelf() {
        when(users.findByUsernameIgnoreCase("alice")).thenReturn(Optional.of(alice));

        assertThatThrownBy(() -> friendService.sendRequest(alice.getId(), "alice"))
                .isInstanceOf(ApiException.class)
                .extracting(ex -> ((ApiException) ex).code())
                .isEqualTo("CANNOT_ADD_SELF");
    }

    @Test
    void unknownUsernameIsRejected() {
        when(users.findByUsernameIgnoreCase("hayalet")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> friendService.sendRequest(alice.getId(), "hayalet"))
                .isInstanceOf(ApiException.class)
                .extracting(ex -> ((ApiException) ex).code())
                .isEqualTo("USER_NOT_FOUND");
    }

    /**
     * Karsi taraf zaten istek gonderdiyse yeni kayit acilmamali; aksi halde iki
     * yonlu bekleyen istek olusur ve ikisi de digerinin kabulunu bekler.
     */
    @Test
    void reverseRequestAutoAcceptsInsteadOfCreatingSecondRow() {
        Friendship bobToAlice = new Friendship(bob, alice);
        ReflectionTestUtils.setField(bobToAlice, "id", UUID.randomUUID());

        when(users.findByUsernameIgnoreCase("bob")).thenReturn(Optional.of(bob));
        when(friendships.findBetween(alice.getId(), bob.getId()))
                .thenReturn(Optional.of(bobToAlice));
        when(friendships.findById(bobToAlice.getId())).thenReturn(Optional.of(bobToAlice));

        friendService.sendRequest(alice.getId(), "bob");

        assertThat(bobToAlice.getStatus()).isEqualTo(FriendshipStatus.ACCEPTED);
        verify(friendships, never()).save(any(Friendship.class));
    }

    @Test
    void duplicateRequestInSameDirectionIsRejected() {
        Friendship pending = new Friendship(alice, bob);
        when(users.findByUsernameIgnoreCase("bob")).thenReturn(Optional.of(bob));
        when(friendships.findBetween(alice.getId(), bob.getId())).thenReturn(Optional.of(pending));

        assertThatThrownBy(() -> friendService.sendRequest(alice.getId(), "bob"))
                .isInstanceOf(ApiException.class)
                .extracting(ex -> ((ApiException) ex).code())
                .isEqualTo("REQUEST_PENDING");
    }

    @Test
    void alreadyFriendsIsRejected() {
        Friendship accepted = new Friendship(alice, bob);
        accepted.accept();
        when(users.findByUsernameIgnoreCase("bob")).thenReturn(Optional.of(bob));
        when(friendships.findBetween(alice.getId(), bob.getId())).thenReturn(Optional.of(accepted));

        assertThatThrownBy(() -> friendService.sendRequest(alice.getId(), "bob"))
                .isInstanceOf(ApiException.class)
                .extracting(ex -> ((ApiException) ex).code())
                .isEqualTo("ALREADY_FRIENDS");
    }

    /** Istegi yalnizca gonderildigi kisi yanitlayabilir. */
    @Test
    void onlyAddresseeCanAccept() {
        Friendship aliceToBob = new Friendship(alice, bob);
        UUID id = UUID.randomUUID();
        ReflectionTestUtils.setField(aliceToBob, "id", id);
        when(friendships.findById(id)).thenReturn(Optional.of(aliceToBob));

        // Gonderen kendi istegini kabul edemez.
        assertThatThrownBy(() -> friendService.accept(id, alice.getId()))
                .isInstanceOf(ApiException.class)
                .extracting(ex -> ((ApiException) ex).code())
                .isEqualTo("REQUEST_NOT_FOUND");
    }

    /**
     * Engellenmis kullaniciya istek gonderildiginde hata degil normal yanit
     * doner: aksi halde engellendigi anlasilirdi.
     */
    @Test
    void blockedRelationDoesNotRevealItself() {
        Friendship blocked = new Friendship(bob, alice);
        blocked.block();
        when(users.findByUsernameIgnoreCase("bob")).thenReturn(Optional.of(bob));
        when(friendships.findBetween(alice.getId(), bob.getId())).thenReturn(Optional.of(blocked));

        var result = friendService.sendRequest(alice.getId(), "bob");

        assertThat(result.displayName()).isEqualTo("Bob");
        verify(friendships, never()).save(any(Friendship.class));
    }
}
