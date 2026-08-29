package com.gameteams.config;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

import com.gameteams.auth.AuthenticatedUser;
import com.gameteams.auth.JwtService;

/**
 * CONNECT frame'inde kimligi dogrular, SUBSCRIBE frame'inde hedefi yetkilendirir.
 *
 * Kimlik HTTP handshake'inde degil CONNECT'te dogrulanir: tarayici WebSocket
 * API'si ozel baslik gondermeye izin vermez, token'i URL'e koymak ise sunucu
 * loglarina sizdirirdi.
 */
@Component
public class StompAuthChannelInterceptor implements ChannelInterceptor {

    private static final String BEARER_PREFIX = "Bearer ";

    private final JwtService jwtService;
    // Lazy cozum: authorizer servis katmanina bagli, mesajlasma altyapisiyla
    // bean olusturma dongusune girmesin.
    private final ObjectProvider<StompDestinationAuthorizer> authorizer;

    StompAuthChannelInterceptor(JwtService jwtService,
            ObjectProvider<StompDestinationAuthorizer> authorizer) {
        this.jwtService = jwtService;
        this.authorizer = authorizer;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor =
                MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null || accessor.getCommand() == null) {
            return message;
        }

        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            authenticate(accessor);
        }
        else if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
            StompPrincipal principal = principalOf(accessor);
            authorizer.getObject()
                    .authorizeSubscription(accessor.getDestination(), principal.userId());
        }

        return message;
    }

    private void authenticate(StompHeaderAccessor accessor) {
        String header = accessor.getFirstNativeHeader("Authorization");
        if (header == null || !header.startsWith(BEARER_PREFIX)) {
            throw new IllegalArgumentException("STOMP CONNECT icin gecerli token gerekli.");
        }

        var claims = jwtService.parseAccessToken(header.substring(BEARER_PREFIX.length()))
                .orElseThrow(() -> new IllegalArgumentException(
                        "Gecersiz veya suresi dolmus token."));

        accessor.setUser(new StompPrincipal(
                new AuthenticatedUser(claims.userId(), claims.username(), claims.role())));
    }

    private StompPrincipal principalOf(StompHeaderAccessor accessor) {
        if (accessor.getUser() instanceof StompPrincipal principal) {
            return principal;
        }
        throw new IllegalArgumentException("Kimlik dogrulanmamis oturum.");
    }
}
