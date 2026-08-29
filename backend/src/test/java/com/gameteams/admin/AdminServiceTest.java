package com.gameteams.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import com.gameteams.auth.RefreshTokenRepository;
import com.gameteams.common.ApiException;
import com.gameteams.message.MessageRepository;
import com.gameteams.room.RoomMemberRepository;
import com.gameteams.room.RoomRepository;
import com.gameteams.user.Role;
import com.gameteams.user.User;
import com.gameteams.user.UserRepository;

@ExtendWith(MockitoExtension.class)
class AdminServiceTest {

    @Mock
    private UserRepository users;

    @Mock
    private RoomRepository rooms;

    @Mock
    private RoomMemberRepository roomMembers;

    @Mock
    private MessageRepository messages;

    @Mock
    private RefreshTokenRepository refreshTokens;

    @InjectMocks
    private AdminService adminService;

    private User target;
    private UUID adminId;

    @BeforeEach
    void setUp() {
        adminId = UUID.randomUUID();
        target = new User("kaan", "Kaan", "kaan@example.com", "hash");
        ReflectionTestUtils.setField(target, "id", UUID.randomUUID());
    }

    /**
     * Yalnizca isaretlemek yetmez: kullanici elindeki refresh token ile
     * 30 gun daha oturum acabilirdi.
     */
    @Test
    void disablingAlsoRevokesAllSessions() {
        when(users.findById(target.getId())).thenReturn(Optional.of(target));

        var result = adminService.disableUser(target.getId(), adminId, "Kural ihlali");

        assertThat(result.disabled()).isTrue();
        assertThat(result.disabledReason()).isEqualTo("Kural ihlali");
        verify(refreshTokens).revokeAllForUser(eq(target), any(Instant.class));
    }

    @Test
    void adminCannotDisableThemselves() {
        // Donen kullanicinin id'si adminId ile ayni olmali; aksi halde
        // "kendini devre disi birakma" dali hic calismaz.
        User self = new User("admin", "Admin", "admin@example.com", "hash");
        ReflectionTestUtils.setField(self, "id", adminId);
        when(users.findById(adminId)).thenReturn(Optional.of(self));

        assertThatThrownBy(() -> adminService.disableUser(adminId, adminId, "test"))
                .isInstanceOf(ApiException.class)
                .extracting(ex -> ((ApiException) ex).code())
                .isEqualTo("CANNOT_DISABLE_SELF");
    }

    /** Son yonetici kilitlenirse sistemi yonetecek kimse kalmaz. */
    @Test
    void adminAccountsCannotBeDisabled() {
        target.setRole(Role.ADMIN);
        when(users.findById(target.getId())).thenReturn(Optional.of(target));

        assertThatThrownBy(() -> adminService.disableUser(target.getId(), adminId, "test"))
                .isInstanceOf(ApiException.class)
                .extracting(ex -> ((ApiException) ex).code())
                .isEqualTo("CANNOT_DISABLE_ADMIN");

        verify(refreshTokens, never()).revokeAllForUser(any(), any());
    }

    @Test
    void enablingClearsDisabledState() {
        target.disable("gecici");
        when(users.findById(target.getId())).thenReturn(Optional.of(target));

        var result = adminService.enableUser(target.getId());

        assertThat(result.disabled()).isFalse();
        assertThat(result.disabledReason()).isNull();
    }

    @Test
    void unknownUserIsRejected() {
        UUID missing = UUID.randomUUID();
        when(users.findById(missing)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> adminService.disableUser(missing, adminId, "test"))
                .isInstanceOf(ApiException.class)
                .extracting(ex -> ((ApiException) ex).code())
                .isEqualTo("USER_NOT_FOUND");
    }

    /** Sayfa boyutu sinirsiz olursa tek istekle tum tablo cekilebilirdi. */
    @Test
    void pageSizeIsCapped() {
        when(users.findAll(any(org.springframework.data.domain.Pageable.class)))
                .thenAnswer(invocation -> {
                    var pageable = invocation.getArgument(0,
                            org.springframework.data.domain.Pageable.class);
                    assertThat(pageable.getPageSize()).isEqualTo(100);
                    return org.springframework.data.domain.Page.empty(pageable);
                });

        adminService.listUsers(null, 0, 100_000);
    }
}
