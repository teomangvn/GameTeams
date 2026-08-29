package com.gameteams.config;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.gameteams.channel.ChannelService;
import com.gameteams.common.ApiException;
import com.gameteams.room.RoomService;

/**
 * Spring'in bellek ici broker'i SUBSCRIBE frame'lerini dogrulamaz; kanal
 * mesajlarinin uye olmayanlara sizmamasi bu siniftaki kontrole bagli.
 */
@ExtendWith(MockitoExtension.class)
class StompDestinationAuthorizerTest {

    @Mock
    private ChannelService channelService;

    @Mock
    private RoomService roomService;

    @InjectMocks
    private StompDestinationAuthorizer authorizer;

    private final UUID userId = UUID.randomUUID();

    @Test
    void channelSubscriptionRequiresChannelAccess() {
        UUID channelId = UUID.randomUUID();

        authorizer.authorizeSubscription("/topic/channel." + channelId, userId);

        verify(channelService).requireAccessibleChannel(channelId, userId);
    }

    @Test
    void channelSubscriptionIsRejectedForNonMember() {
        UUID channelId = UUID.randomUUID();
        when(channelService.requireAccessibleChannel(channelId, userId))
                .thenThrow(ApiException.notFound("CHANNEL_NOT_FOUND", "Kanal bulunamadi."));

        assertThatThrownBy(() -> authorizer.authorizeSubscription("/topic/channel." + channelId, userId))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("abone olamazsin");
    }

    @Test
    void roomSubscriptionRequiresMembership() {
        UUID roomId = UUID.randomUUID();

        authorizer.authorizeSubscription("/topic/room." + roomId, userId);

        verify(roomService).requireMember(roomId, userId);
    }

    /** /user/** hedeflerini Spring oturumun principal'ina gore cozer. */
    @Test
    void userDestinationsNeedNoExtraCheck() {
        assertThatCode(() -> authorizer.authorizeSubscription("/user/queue/errors", userId))
                .doesNotThrowAnyException();

        verifyNoInteractions(channelService, roomService);
    }

    /**
     * Yeni bir topic eklenip yetkilendirmesi yazilmazsa sizdirmak yerine
     * calismamali.
     */
    @Test
    void unknownDestinationsAreDeniedByDefault() {
        assertThatThrownBy(() -> authorizer.authorizeSubscription("/topic/gizli", userId))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Bilinmeyen abonelik hedefi");
    }

    @Test
    void malformedIdIsRejected() {
        assertThatThrownBy(() -> authorizer.authorizeSubscription("/topic/channel.abc", userId))
                .isInstanceOf(IllegalArgumentException.class);

        verify(channelService, org.mockito.Mockito.never())
                .requireAccessibleChannel(any(), any());
    }

    @Test
    void blankDestinationIsRejected() {
        assertThatThrownBy(() -> authorizer.authorizeSubscription("", userId))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
