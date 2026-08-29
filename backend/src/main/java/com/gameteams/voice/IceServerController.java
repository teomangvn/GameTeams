package com.gameteams.voice;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import com.gameteams.auth.AuthenticatedUser;
import com.gameteams.channel.ChannelService;
import com.gameteams.config.GameTeamsProperties;
import com.gameteams.voice.VoiceDtos.IceServer;
import com.gameteams.voice.VoiceDtos.IceServersResponse;
import com.gameteams.voice.VoiceDtos.VoiceParticipant;

@RestController
public class IceServerController {

    private final GameTeamsProperties properties;
    private final VoiceStateService voiceState;
    private final ChannelService channelService;

    IceServerController(GameTeamsProperties properties, VoiceStateService voiceState,
            ChannelService channelService) {
        this.properties = properties;
        this.voiceState = voiceState;
        this.channelService = channelService;
    }

    /**
     * Tarayicinin RTCPeerConnection'a verecegi ICE sunuculari.
     *
     * TURN kimlik bilgileri statik degil, zaman sinirlidir: coturn'un
     * "use-auth-secret" modeliyle kullanici adi "<bitis-zamani>:<userId>",
     * parola ise bu dizenin paylasilan sirla HMAC-SHA1 imzasidir. Boylece
     * sizan bir kimlik bilgisi kisa surede gecersiz olur ve TURN sunucusu
     * herkese acik bir relay'e donusmez.
     */
    @GetMapping("/api/webrtc/ice-servers")
    IceServersResponse iceServers(@AuthenticationPrincipal AuthenticatedUser me) {
        var config = properties.webrtc();
        List<IceServer> servers = new ArrayList<>();

        if (config.stunUrls() != null && !config.stunUrls().isEmpty()) {
            servers.add(new IceServer(config.stunUrls(), null, null));
        }

        boolean turnConfigured = config.turnUrls() != null && !config.turnUrls().isEmpty()
                && config.turnSecret() != null && !config.turnSecret().isBlank();

        if (turnConfigured) {
            long expiry = Instant.now().plus(config.turnCredentialTtl()).getEpochSecond();
            String username = expiry + ":" + me.id();
            servers.add(new IceServer(config.turnUrls(), username,
                    hmacSha1Base64(config.turnSecret(), username)));
        }

        return new IceServersResponse(servers);
    }

    /** Kanala girmeden once kimlerin oldugunu gostermek icin. */
    @GetMapping("/api/voice/channels/{channelId}/participants")
    List<VoiceParticipant> participants(@AuthenticationPrincipal AuthenticatedUser me,
            @PathVariable UUID channelId) {
        channelService.requireAccessibleChannel(channelId, me.id());
        return voiceState.participants(channelId);
    }

    private static String hmacSha1Base64(String secret, String message) {
        try {
            Mac mac = Mac.getInstance("HmacSHA1");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA1"));
            return Base64.getEncoder()
                    .encodeToString(mac.doFinal(message.getBytes(StandardCharsets.UTF_8)));
        }
        catch (java.security.GeneralSecurityException ex) {
            throw new IllegalStateException("TURN kimlik bilgisi uretilemedi", ex);
        }
    }
}
