package com.gameteams.voice;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.gameteams.channel.Channel;
import com.gameteams.channel.ChannelService;
import com.gameteams.channel.ChannelType;
import com.gameteams.common.ApiException;
import com.gameteams.dm.DmConversation;
import com.gameteams.dm.DmService;

@ExtendWith(MockitoExtension.class)
class VoiceAccessServiceTest {

    @Mock
    private ChannelService channelService;

    @Mock
    private DmService dmService;

    @Mock
    private com.gameteams.block.BlockService blocks;

    @InjectMocks
    private VoiceAccessService access;

    private final UUID userId = UUID.randomUUID();
    private final UUID spaceId = UUID.randomUUID();

    @Test
    void ses_kanali_kendi_limitiyle_doner() {
        Channel channel = mock(Channel.class);
        when(channel.getId()).thenReturn(spaceId);
        when(channel.getType()).thenReturn(ChannelType.VOICE);
        when(channel.getUserLimit()).thenReturn(4);
        when(channelService.requireAccessibleChannel(spaceId, userId)).thenReturn(channel);

        var space = access.requireAccess(spaceId, userId);

        assertThat(space.userLimit()).isEqualTo(4);
        assertThat(space.directCall()).isFalse();
        verify(dmService, never()).requireParticipant(any(), any());
    }

    @Test
    void metin_kanalina_sesle_girilemez() {
        Channel channel = mock(Channel.class);
        when(channel.getType()).thenReturn(ChannelType.TEXT);
        when(channelService.requireAccessibleChannel(spaceId, userId)).thenReturn(channel);

        assertThatThrownBy(() -> access.requireAccess(spaceId, userId))
                .isInstanceOf(ApiException.class)
                .extracting("code").isEqualTo("NOT_A_VOICE_CHANNEL");
    }

    @Test
    void kanal_degilse_dm_sohbeti_iki_kisilik_arama_olur() {
        when(channelService.requireAccessibleChannel(spaceId, userId))
                .thenThrow(ApiException.notFound("CHANNEL_NOT_FOUND", "Kanal bulunamadi."));
        DmConversation conversation = mock(DmConversation.class);
        when(conversation.getId()).thenReturn(spaceId);
        when(conversation.otherThan(userId)).thenReturn(other());
        when(dmService.requireParticipant(spaceId, userId)).thenReturn(conversation);

        var space = access.requireAccess(spaceId, userId);

        assertThat(space.userLimit()).isEqualTo(2);
        assertThat(space.directCall()).isTrue();
    }

    /** Engelledikten sonra ne arama alanina girilir ne de oradaki ses dinlenir. */
    @Test
    void engel_varsa_aramaya_girilemez() {
        when(channelService.requireAccessibleChannel(spaceId, userId))
                .thenThrow(ApiException.notFound("CHANNEL_NOT_FOUND", "Kanal bulunamadi."));
        DmConversation conversation = mock(DmConversation.class);
        com.gameteams.user.User other = other();
        when(conversation.otherThan(userId)).thenReturn(other);
        when(dmService.requireParticipant(spaceId, userId)).thenReturn(conversation);
        when(blocks.isBlockedEitherWay(userId, other.getId())).thenReturn(true);

        assertThatThrownBy(() -> access.requireAccess(spaceId, userId))
                .isInstanceOf(ApiException.class)
                .extracting("code").isEqualTo("CALL_NOT_AVAILABLE");
    }

    private static com.gameteams.user.User other() {
        var user = new com.gameteams.user.User("other", "Other", "o@example.com", "hash");
        org.springframework.test.util.ReflectionTestUtils.setField(user, "id", UUID.randomUUID());
        return user;
    }

    /** Sohbetin tarafi olmayan biri aramaya katilamaz veya dinleyemez. */
    @Test
    void sohbete_dahil_olmayan_aramaya_giremez() {
        when(channelService.requireAccessibleChannel(spaceId, userId))
                .thenThrow(ApiException.notFound("CHANNEL_NOT_FOUND", "Kanal bulunamadi."));
        when(dmService.requireParticipant(spaceId, userId))
                .thenThrow(ApiException.notFound("CONVERSATION_NOT_FOUND", "Sohbet bulunamadi."));

        assertThatThrownBy(() -> access.requireAccess(spaceId, userId))
                .isInstanceOf(ApiException.class)
                .extracting("code").isEqualTo("CONVERSATION_NOT_FOUND");
    }

    /** Odaya uye olmayan, kanal kimligini DM gibi deneyerek kontrolu atlatamamali. */
    @Test
    void kanal_uyelik_hatasi_dm_denemesine_donusmez() {
        when(channelService.requireAccessibleChannel(spaceId, userId))
                .thenThrow(ApiException.forbidden("NOT_A_MEMBER", "Uye degilsin."));

        assertThatThrownBy(() -> access.requireAccess(spaceId, userId))
                .isInstanceOf(ApiException.class)
                .extracting("code").isEqualTo("NOT_A_MEMBER");
        verify(dmService, never()).requireParticipant(any(), any());
    }
}
