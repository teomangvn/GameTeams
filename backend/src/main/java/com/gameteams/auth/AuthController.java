package com.gameteams.auth;

import java.time.Duration;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.gameteams.auth.AuthDtos.AuthResponse;
import com.gameteams.auth.AuthDtos.EmailOnlyRequest;
import com.gameteams.auth.AuthDtos.LoginRequest;
import com.gameteams.auth.AuthDtos.LoginResponse;
import com.gameteams.auth.AuthDtos.MessageResponse;
import com.gameteams.auth.AuthDtos.RegisterRequest;
import com.gameteams.auth.AuthDtos.ResetPasswordRequest;
import com.gameteams.auth.AuthDtos.UserResponse;
import com.gameteams.auth.AuthDtos.VerifyDeviceRequest;
import com.gameteams.auth.AuthDtos.VerifyEmailRequest;
import com.gameteams.common.ApiException;
import com.gameteams.common.RateLimiter;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    static final String REFRESH_COOKIE = AuthCookies.REFRESH_COOKIE;
    static final String DEVICE_COOKIE = AuthCookies.DEVICE_COOKIE;

    private final AuthService authService;
    private final RateLimiter rateLimiter;
    private final AuthCookies cookies;

    AuthController(AuthService authService, RateLimiter rateLimiter, AuthCookies cookies) {
        this.authService = authService;
        this.rateLimiter = rateLimiter;
        this.cookies = cookies;
    }

    @PostMapping("/register")
    ResponseEntity<MessageResponse> register(@Valid @RequestBody RegisterRequest request,
            HttpServletRequest http) {

        rateLimiter.check("register:" + clientIp(http), 5, Duration.ofHours(1),
                "Çok fazla kayıt denemesi. Bir saat sonra tekrar dene.");

        authService.register(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(new MessageResponse(
                "Hesabın oluşturuldu. Doğrulama bağlantısı e-postana gönderildi."));
    }

    @PostMapping("/verify-email")
    ResponseEntity<MessageResponse> verifyEmail(@Valid @RequestBody VerifyEmailRequest request) {
        authService.verifyEmail(request.token());
        return ResponseEntity.ok(new MessageResponse("E-postan doğrulandı. Artık giriş yapabilirsin."));
    }

    @PostMapping("/resend-verification")
    ResponseEntity<MessageResponse> resendVerification(@Valid @RequestBody EmailOnlyRequest request,
            HttpServletRequest http) {

        rateLimiter.check("resend:" + clientIp(http), 3, Duration.ofHours(1),
                "Çok fazla istek. Bir saat sonra tekrar dene.");

        authService.resendVerification(request.email());
        // Adres kayıtlı değilse bile aynı yanıt döner (enumeration önlemi).
        return ResponseEntity.ok(new MessageResponse(
                "Adres kayıtlıysa doğrulama bağlantısı gönderildi."));
    }

    @PostMapping("/login")
    ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request,
            HttpServletRequest http) {

        rateLimiter.check("login:" + clientIp(http), 10, Duration.ofMinutes(1),
                "Çok fazla giriş denemesi. Bir dakika sonra tekrar dene.");

        var outcome = authService.login(request, http.getHeader(HttpHeaders.USER_AGENT),
                clientIp(http), readCookie(http, DEVICE_COOKIE));

        if (outcome instanceof AuthService.LoginOutcome.ChallengeRequired challenge) {
            // Oturum acilmadi: refresh cookie'si yazilmaz.
            return ResponseEntity.ok(
                    LoginResponse.challenge(challenge.challengeId(), challenge.maskedEmail()));
        }

        var result = ((AuthService.LoginOutcome.Authenticated) outcome).result();
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, refreshCookie(result.refreshToken(),
                        result.refreshTtl()).toString())
                .body(LoginResponse.authenticated(result.response()));
    }

    /**
     * Yeni cihaz dogrulamasi. Kod dogruysa oturum acilir; kullanici cihazi
     * hatirlamak istediyse ayrica uzun omurlu bir cihaz cerezi yazilir.
     */
    @PostMapping("/verify-device")
    ResponseEntity<AuthResponse> verifyDevice(@Valid @RequestBody VerifyDeviceRequest request,
            HttpServletRequest http) {

        rateLimiter.check("verify-device:" + clientIp(http), 10, Duration.ofMinutes(5),
                "Çok fazla deneme. Biraz sonra tekrar dene.");

        String userAgent = http.getHeader(HttpHeaders.USER_AGENT);
        var result = authService.completeDeviceChallenge(
                request.challengeId(), request.code(), userAgent, clientIp(http));

        var response = ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE,
                        refreshCookie(result.refreshToken(), result.refreshTtl()).toString());

        if (request.rememberDevice()) {
            String deviceToken = authService.trustCurrentDevice(result.response().user().id(), userAgent);
            response.header(HttpHeaders.SET_COOKIE,
                    deviceCookie(deviceToken, authService.deviceTrustTtl()).toString());
        }

        return response.body(result.response());
    }

    @PostMapping("/refresh")
    ResponseEntity<AuthResponse> refresh(
            @CookieValue(name = REFRESH_COOKIE, required = false) String refreshToken,
            HttpServletRequest http) {

        if (refreshToken == null || refreshToken.isBlank()) {
            throw ApiException.unauthorized("NO_REFRESH_TOKEN", "Oturum bulunamadı. Tekrar giriş yap.");
        }

        var result = authService.refresh(refreshToken,
                http.getHeader(HttpHeaders.USER_AGENT), clientIp(http));
        return withRefreshCookie(result);
    }

    @PostMapping("/logout")
    ResponseEntity<MessageResponse> logout(
            @CookieValue(name = REFRESH_COOKIE, required = false) String refreshToken) {

        authService.logout(refreshToken);
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, expiredRefreshCookie().toString())
                .body(new MessageResponse("Çıkış yapıldı."));
    }

    @PostMapping("/forgot-password")
    ResponseEntity<MessageResponse> forgotPassword(@Valid @RequestBody EmailOnlyRequest request,
            HttpServletRequest http) {

        rateLimiter.check("forgot:" + clientIp(http), 3, Duration.ofHours(1),
                "Çok fazla istek. Bir saat sonra tekrar dene.");

        authService.requestPasswordReset(request.email());
        return ResponseEntity.ok(new MessageResponse(
                "Adres kayıtlıysa sıfırlama bağlantısı gönderildi."));
    }

    @PostMapping("/reset-password")
    ResponseEntity<MessageResponse> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        authService.resetPassword(request.token(), request.newPassword());
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, expiredRefreshCookie().toString())
                .body(new MessageResponse("Şifren güncellendi. Yeni şifrenle giriş yapabilirsin."));
    }

    /** Giriş yapmış kullanıcının kendi profili. */
    @GetMapping("/me")
    ResponseEntity<UserResponse> me(@AuthenticationPrincipal AuthenticatedUser principal) {
        if (principal == null) {
            throw ApiException.unauthorized("UNAUTHENTICATED", "Giriş yapman gerekiyor.");
        }
        return authService.currentUser(principal)
                .map(ResponseEntity::ok)
                .orElseThrow(() -> ApiException.unauthorized(
                        "USER_NOT_FOUND", "Hesabın bulunamadı."));
    }

    /* ------------------------------ Yardımcı ------------------------------ */

    private ResponseEntity<AuthResponse> withRefreshCookie(AuthService.LoginResult result) {
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE,
                        refreshCookie(result.refreshToken(), result.refreshTtl()).toString())
                .body(result.response());
    }

    private ResponseCookie refreshCookie(String value, Duration ttl) {
        return cookies.refresh(value, ttl);
    }

    private ResponseCookie expiredRefreshCookie() {
        return cookies.expiredRefresh();
    }

    private ResponseCookie deviceCookie(String value, Duration ttl) {
        return cookies.device(value, ttl);
    }

    private static String readCookie(HttpServletRequest request, String name) {
        if (request.getCookies() == null) {
            return null;
        }
        for (var cookie : request.getCookies()) {
            if (name.equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }

    /** Ters vekil arkasında gerçek istemci IP'si X-Forwarded-For'da gelir. */
    public static String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
