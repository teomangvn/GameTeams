package com.gameteams.block;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
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
import com.gameteams.friend.Friendship;
import com.gameteams.friend.FriendshipRepository;
import com.gameteams.user.User;
import com.gameteams.user.UserRepository;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class BlockServiceTest {

    @Mock
    private UserBlockRepository blocks;

    @Mock
    private FriendshipRepository friendships;

    @Mock
    private UserRepository users;

    @Mock
    private SimpMessagingTemplate broker;

    @InjectMocks
    private BlockService blockService;

    private User alice;
    private User bob;

    @BeforeEach
    void setUp() {
        alice = user("alice");
        bob = user("bob");
        when(users.findById(alice.getId())).thenReturn(Optional.of(alice));
        when(users.findById(bob.getId())).thenReturn(Optional.of(bob));
    }

    private static User user(String username) {
        User user = new User(username, username, username + "@example.com", "hash");
        ReflectionTestUtils.setField(user, "id", UUID.randomUUID());
        return user;
    }

    @Test
    void kendini_engelleyemez() {
        assertThatThrownBy(() -> blockService.block(alice.getId(), alice.getId()))
                .isInstanceOf(ApiException.class)
                .extracting("code").isEqualTo("CANNOT_BLOCK_SELF");
    }

    /** Engel arkadasligi bitirir; karsi tarafin listesi tazelensin diye olay gider. */
    @Test
    void engel_arkadasligi_siler_ve_karsi_tarafi_haberdar_eder() {
        Friendship friendship = new Friendship(bob, alice);
        ReflectionTestUtils.setField(friendship, "id", UUID.randomUUID());
        when(friendships.findBetween(alice.getId(), bob.getId())).thenReturn(Optional.of(friendship));

        blockService.block(alice.getId(), bob.getId());

        verify(friendships).delete(friendship);
        verify(broker).convertAndSendToUser(eq(bob.getId().toString()), eq("/queue/friends"), any(Object.class));
        verify(blocks).save(any(UserBlock.class));
    }

    @Test
    void zaten_engelliyse_ikinci_kayit_acilmaz() {
        when(blocks.hasBlocked(alice.getId(), bob.getId())).thenReturn(true);

        blockService.block(alice.getId(), bob.getId());

        verify(blocks, never()).save(any());
    }

    @Test
    void engeli_kaldirmak_yalnizca_kendi_engelini_siler() {
        UserBlock block = new UserBlock(alice, bob);
        when(blocks.find(alice.getId(), bob.getId())).thenReturn(Optional.of(block));

        blockService.unblock(alice.getId(), bob.getId());

        verify(blocks).delete(block);
        // Bob'un Alice'i engellemesi (ters yon) bu cagriyla sorgulanmaz bile.
        verify(blocks, never()).find(bob.getId(), alice.getId());
    }
}
