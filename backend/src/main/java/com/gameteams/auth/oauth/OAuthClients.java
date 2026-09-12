package com.gameteams.auth.oauth;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.config.oauth2.client.CommonOAuth2Provider;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository;
import org.springframework.stereotype.Component;

import com.gameteams.config.GameTeamsProperties;

/**
 * Yapilandirilmis harici giris saglayicilari.
 *
 * Spring Boot'un spring.security.oauth2.client.* ayarlari kullanilmiyor: orada
 * bos client-id uygulamanin acilmasini engelliyor. Burada kimligi tanimli
 * olmayan saglayici sessizce atlanir; dev ortami ve kimlik bilgisi girilmemis
 * sunucular harici giris olmadan calismaya devam eder.
 */
@Component
public class OAuthClients {

    private static final Logger log = LoggerFactory.getLogger(OAuthClients.class);

    /** Adresler APP_URL uzerinden kurulur: istek dev'de Vite, prod'da nginx vekilinden gecer. */
    public static final String AUTHORIZATION_BASE = "/api/auth/oauth2/authorization";
    public static final String CALLBACK_BASE = "/api/auth/oauth2/callback";

    /**
     * Graph API surumu. Spring'in hazir Facebook tanimi 2016'dan kalma v2.8'i
     * kullaniyor. Emekliye ayrilan surume yapilan cagrilar Meta tarafindan en
     * eski desteklenen surume yukseltilir; yani bu sabit eskise de giris bozulmaz.
     */
    private static final String FACEBOOK_GRAPH_VERSION = "v23.0";

    private final List<ClientRegistration> registrations;

    OAuthClients(GameTeamsProperties properties) {
        List<ClientRegistration> enabled = new ArrayList<>();
        GameTeamsProperties.Oauth oauth = properties.oauth();
        String redirectUri = properties.appUrl() + CALLBACK_BASE + "/{registrationId}";

        if (oauth != null && oauth.google() != null && oauth.google().enabled()) {
            enabled.add(CommonOAuth2Provider.GOOGLE.getBuilder(OAuthProfile.GOOGLE)
                    .clientId(oauth.google().clientId())
                    .clientSecret(oauth.google().clientSecret())
                    .redirectUri(redirectUri)
                    .scope("openid", "profile", "email")
                    .build());
        }

        if (oauth != null && oauth.facebook() != null && oauth.facebook().enabled()) {
            String graph = "https://graph.facebook.com/" + FACEBOOK_GRAPH_VERSION;
            enabled.add(CommonOAuth2Provider.FACEBOOK.getBuilder(OAuthProfile.FACEBOOK)
                    .clientId(oauth.facebook().clientId())
                    .clientSecret(oauth.facebook().clientSecret())
                    .redirectUri(redirectUri)
                    .scope("public_profile", "email")
                    .authorizationUri("https://www.facebook.com/" + FACEBOOK_GRAPH_VERSION + "/dialog/oauth")
                    .tokenUri(graph + "/oauth/access_token")
                    .userInfoUri(graph + "/me?fields=id,name,email")
                    .build());
        }

        this.registrations = List.copyOf(enabled);
        log.info("Harici giris saglayicilari: {}",
                registrations.isEmpty() ? "yok" : providerIds());
    }

    /** Arayuzde buton gosterilecek saglayicilar. */
    public List<String> providerIds() {
        return registrations.stream().map(ClientRegistration::getRegistrationId).toList();
    }

    /** Hic saglayici yoksa bos: InMemoryClientRegistrationRepository bos listeyi kabul etmez. */
    public Optional<ClientRegistrationRepository> repository() {
        return registrations.isEmpty()
                ? Optional.empty()
                : Optional.of(new InMemoryClientRegistrationRepository(registrations));
    }
}
