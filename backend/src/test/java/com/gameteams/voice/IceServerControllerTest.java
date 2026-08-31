package com.gameteams.voice;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.junit.jupiter.api.Test;

import com.gameteams.auth.AuthenticatedUser;
import com.gameteams.channel.ChannelService;
import com.gameteams.config.GameTeamsProperties;
import com.gameteams.user.Role;

/**
 * TURN kimlik bilgileri statik olmamali: sizan bir sifre kalici relay erisimi
 * verirse TURN sunucusu herkese acik bir proxy'ye doner.
 */
class IceServerControllerTest {

    private static final String TURN_SECRET = "paylasilan-turn-sirri";

    private static IceServerController controllerWith(List<String> turnUrls, String secret) {
        var properties = new GameTeamsProperties(
                "http://localhost:5173",
                "no-reply@gameteams.local",
                new GameTeamsProperties.Cors(List.of("http://localhost:5173")),
                new GameTeamsProperties.Jwt("secret-that-is-long-enough-for-hmac-256!!",
                        Duration.ofMinutes(15), Duration.ofDays(30)),
                new GameTeamsProperties.Admin("admin", "", ""),
                new GameTeamsProperties.Webrtc(
                        List.of("stun:stun.l.google.com:19302"),
                        turnUrls, secret, Duration.ofHours(12)),
                new GameTeamsProperties.Cookie(false, "Lax"),
                new GameTeamsProperties.Uploads("./uploads/avatars", 2_097_152L));

        return new IceServerController(properties, mock(VoiceStateService.class),
                mock(ChannelService.class));
    }

    private static AuthenticatedUser user() {
        return new AuthenticatedUser(UUID.randomUUID(), "teoman", Role.USER);
    }

    @Test
    void turnIsOmittedWhenNotConfigured() {
        var response = controllerWith(List.of(), "").iceServers(user());

        assertThat(response.iceServers()).hasSize(1);
        assertThat(response.iceServers().get(0).urls()).contains("stun:stun.l.google.com:19302");
        assertThat(response.iceServers().get(0).credential()).isNull();
    }

    @Test
    void turnCredentialsAreTimeLimitedAndHmacSigned() throws Exception {
        var me = user();
        var response = controllerWith(List.of("turn:turn.example:3478"), TURN_SECRET)
                .iceServers(me);

        assertThat(response.iceServers()).hasSize(2);
        var turn = response.iceServers().get(1);

        // Kullanici adi "<bitis-zamani>:<userId>" bicimindedir.
        String[] parts = turn.username().split(":", 2);
        long expiry = Long.parseLong(parts[0]);
        assertThat(parts[1]).isEqualTo(me.id().toString());
        assertThat(expiry).isGreaterThan(Instant.now().getEpochSecond());

        // Parola, kullanici adinin paylasilan sirla HMAC-SHA1 imzasi olmali.
        Mac mac = Mac.getInstance("HmacSHA1");
        mac.init(new SecretKeySpec(TURN_SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA1"));
        String expected = Base64.getEncoder()
                .encodeToString(mac.doFinal(turn.username().getBytes(StandardCharsets.UTF_8)));

        assertThat(turn.credential()).isEqualTo(expected);
    }

    @Test
    void eachUserGetsDistinctCredentials() {
        var controller = controllerWith(List.of("turn:turn.example:3478"), TURN_SECRET);

        String first = controller.iceServers(user()).iceServers().get(1).credential();
        String second = controller.iceServers(user()).iceServers().get(1).credential();

        assertThat(first).isNotEqualTo(second);
    }
}
