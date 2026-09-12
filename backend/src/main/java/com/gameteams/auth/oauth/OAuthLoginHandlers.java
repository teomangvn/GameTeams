package com.gameteams.auth.oauth;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import com.gameteams.auth.AuthController;
import com.gameteams.auth.AuthCookies;
import com.gameteams.auth.AuthService;
import com.gameteams.common.ApiException;
import com.gameteams.config.GameTeamsProperties;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

/**
 * Harici giris donusu.
 *
 * Basarida sifreli girisle ayni refresh cerezi yazilir ve kullanici arayuzun
 * /oauth/callback sayfasina yonlendirilir; o sayfa /api/auth/refresh ile
 * access token'i alir. Token URL'de tasinmaz: tarayici gecmisine, loglara ve
 * Referer basligina sizardi.
 */
@Component
public class OAuthLoginHandlers {

    private static final Logger log = LoggerFactory.getLogger(OAuthLoginHandlers.class);

    private final OAuthAccountService accounts;
    private final AuthService authService;
    private final AuthCookies cookies;
    private final TransactionTemplate transactions;
    private final String appUrl;

    OAuthLoginHandlers(OAuthAccountService accounts, AuthService authService, AuthCookies cookies,
            TransactionTemplate transactions, GameTeamsProperties properties) {
        this.accounts = accounts;
        this.authService = authService;
        this.cookies = cookies;
        this.transactions = transactions;
        this.appUrl = properties.appUrl();
    }

    public AuthenticationSuccessHandler success() {
        return (request, response, authentication) -> {
            try {
                var token = (OAuth2AuthenticationToken) authentication;
                OAuthProfile profile = OAuthProfile.from(
                        token.getAuthorizedClientRegistrationId(), token.getPrincipal());

                String userAgent = request.getHeader(HttpHeaders.USER_AGENT);
                String ip = AuthController.clientIp(request);

                // Eslestirme ve token uretimi tek islemde: yarida kalirsa ne
                // kimlik baglanir ne de sahipsiz bir oturum olusur.
                var result = transactions.execute(status ->
                        authService.completeExternalLogin(accounts.resolve(profile), userAgent, ip));

                response.addHeader(HttpHeaders.SET_COOKIE,
                        cookies.refresh(result.refreshToken(), result.refreshTtl()).toString());
                redirect(response, "/oauth/callback");
            }
            catch (OAuthLoginException ex) {
                log.info("Harici giris reddedildi [{}]: {}", ex.getCode(), ex.getMessage());
                redirectToLogin(response, ex.getCode());
            }
            catch (ApiException ex) {
                redirectToLogin(response, ex.code());
            }
            finally {
                endFlowSession(request);
            }
        };
    }

    public AuthenticationFailureHandler failure() {
        return (request, response, exception) -> {
            String code = "PROVIDER_ERROR";
            if (exception instanceof OAuth2AuthenticationException oauth
                    && "access_denied".equals(oauth.getError().getErrorCode())) {
                // Kullanici saglayici ekraninda "iptal" dedi; hata gibi gosterilmemeli.
                code = "CANCELLED";
            }
            else {
                log.warn("Harici giris basarisiz: {}", exception.getMessage());
            }
            endFlowSession(request);
            redirectToLogin(response, code);
        };
    }

    /**
     * Yetkilendirme istegi (state) akis boyunca HTTP oturumunda tutuluyor. Uygulama
     * baska hicbir yerde oturum kullanmiyor; akis bitince hemen kapatilir.
     */
    private static void endFlowSession(HttpServletRequest request) {
        SecurityContextHolder.clearContext();
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
    }

    private void redirectToLogin(HttpServletResponse response, String code) throws IOException {
        redirect(response, "/login?oauthError=" + URLEncoder.encode(code, StandardCharsets.UTF_8));
    }

    private void redirect(HttpServletResponse response, String path) throws IOException {
        response.sendRedirect(appUrl + path);
    }
}
