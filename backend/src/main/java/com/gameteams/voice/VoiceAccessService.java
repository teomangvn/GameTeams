package com.gameteams.voice;

import java.util.UUID;

import org.springframework.stereotype.Service;

import com.gameteams.block.BlockService;
import com.gameteams.channel.Channel;
import com.gameteams.channel.ChannelService;
import com.gameteams.channel.ChannelType;
import com.gameteams.common.ApiException;
import com.gameteams.dm.DmConversation;
import com.gameteams.dm.DmService;

/**
 * Bir ses alanina erisim.
 *
 * Ses alani ya bir odanin ses kanali ya da iki kisilik bir DM sohbetidir
 * (sesli arama). Ikisi de ayni katilim, sinyallesme ve Redis durumunu
 * kullanir; boylece izgara, kamera, ekran paylasimi ve gurultu engelleme
 * aramalarda da ek kod olmadan calisir. Kimlikler UUID oldugu icin kanal ile
 * sohbet kimligi cakismaz.
 */
@Service
public class VoiceAccessService {

    /** Sesli arama birebir; ucuncu kisi katilamaz. */
    static final int DM_CALL_LIMIT = 2;
    private static final int DEFAULT_CHANNEL_LIMIT = 6;

    private final ChannelService channelService;
    private final DmService dmService;
    private final BlockService blocks;

    VoiceAccessService(ChannelService channelService, DmService dmService, BlockService blocks) {
        this.channelService = channelService;
        this.dmService = dmService;
        this.blocks = blocks;
    }

    /**
     * Kullanicinin bu ses alanina girebildigini dogrular. Kanal degilse DM
     * sohbeti olarak denenir; ikisi de degilse (veya kullanici uye degilse)
     * 404 doner.
     */
    public VoiceSpace requireAccess(UUID spaceId, UUID userId) {
        Channel channel;
        try {
            channel = channelService.requireAccessibleChannel(spaceId, userId);
        }
        catch (ApiException ex) {
            if (!"CHANNEL_NOT_FOUND".equals(ex.code())) {
                throw ex;
            }
            DmConversation conversation = dmService.requireParticipant(spaceId, userId);
            // Engel sonrasi arama alanina katilmak da, dinlemek de yok.
            if (blocks.isBlockedEitherWay(userId, conversation.otherThan(userId).getId())) {
                throw ApiException.forbidden("CALL_NOT_AVAILABLE", "Bu kullanıcıyla arama yapılamaz.");
            }
            return new VoiceSpace(conversation.getId(), DM_CALL_LIMIT, true);
        }

        if (channel.getType() != ChannelType.VOICE) {
            throw ApiException.badRequest("NOT_A_VOICE_CHANNEL", "Bu kanal ses kanali degil.");
        }
        int limit = channel.getUserLimit() != null ? channel.getUserLimit() : DEFAULT_CHANNEL_LIMIT;
        return new VoiceSpace(channel.getId(), limit, false);
    }

    public record VoiceSpace(UUID id, int userLimit, boolean directCall) {
    }
}
