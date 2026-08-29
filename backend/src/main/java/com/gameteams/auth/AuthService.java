package com.gameteams.auth;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.gameteams.auth.AuthDtos.AuthResponse;
import com.gameteams.auth.AuthDtos.LoginRequest;
import com.gameteams.auth.AuthDtos.RegisterRequest;
import com.gameteams.auth.AuthDtos.UserResponse;
import com.gameteams.common.ApiException;
import com.gameteams.config.GameTeamsProperties;
import com.gameteams.mail.EmailSender;
import com.gameteams.user.User;
import com.gameteams.user.UserRepository;

@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private static final Duration VERIFICATION_TTL = Duration.ofHours(24);
    private static final Duration RESET_TTL = Duration.ofHours(1);

    private final UserRepository users;
    private final RefreshTokenRepository refreshTokens;
    private final RefreshTokenRevoker revoker;
    private final EmailVerificationTokenRepository verificationTokens;
    private final PasswordResetTokenRepository resetTokens;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final EmailSender emailSender;
    private final GameTeamsProperties properties;

    AuthService(UserRepository users,
            RefreshTokenRepository refreshTokens,
            RefreshTokenRevoker revoker,
            EmailVerificationTokenRepository verificationTokens,
            PasswordResetTokenRepository resetTokens,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            EmailSender emailSender,
            GameTeamsProperties properties) {
        this.users = users;
        this.refreshTokens = refreshTokens;
        this.revoker = revoker;
        this.verificationTokens = verificationTokens;
        this.resetTokens = resetTokens;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.emailSender = emailSender;
        this.properties = properties;
    }

    /* ------------------------------- Kayıt -------------------------------- */

    @Transactional
    public void register(RegisterRequest request) {
        if (users.existsByEmailIgnoreCase(request.email())) {
            throw ApiException.conflict("EMAIL_TAKEN", "Bu e-posta zaten kayıtlı.");
        }
        if (users.existsByUsernameIgnoreCase(request.username())) {
            throw ApiException.conflict("USERNAME_TAKEN", "Bu kullanıcı adı alınmış.");
        }

        User user = new User(
                request.username(),
                request.displayName(),
                request.email(),
                passwordEncoder.encode(request.password()));
        users.save(user);

        sendVerification(user);
        log.info("Yeni kayıt: {}", user.getUsername());
    }

    /** Yeni doğrulama maili gönderir; önceki token'ları geçersizleştirir. */
    @Transactional
    public void resendVerification(String email) {
        // Yanıt her durumda aynıdır: adresin kayıtlı olup olmadığı sızmamalı.
        users.findByEmailIgnoreCase(email)
                .filter(user -> !user.isEmailVerified())
                .ifPresent(this::sendVerification);
    }

    private void sendVerification(User user) {
        verificationTokens.invalidateAllForUser(user, Instant.now());

        String rawToken = SecureTokens.generate();
        verificationTokens.save(new EmailVerificationToken(
                user, SecureTokens.hash(rawToken), Instant.now().plus(VERIFICATION_TTL)));

        emailSender.sendVerificationEmail(
                user.getEmail(),
                user.getDisplayName(),
                buildUrl("/verify-email", rawToken));
    }

    @Transactional
    public void verifyEmail(String rawToken) {
        EmailVerificationToken token = verificationTokens
                .findByTokenHash(SecureTokens.hash(rawToken))
                .filter(OneTimeToken::isUsable)
                .orElseThrow(() -> ApiException.badRequest(
                        "INVALID_TOKEN", "Doğrulama bağlantısı geçersiz veya süresi dolmuş."));

        token.markUsed();
        token.getUser().setEmailVerified(true);
    }

    /* ------------------------------- Giriş -------------------------------- */

    @Transactional
    public LoginResult login(LoginRequest request, String userAgent, String ip) {
        User user = users.findByEmailIgnoreCase(request.email())
                .filter(u -> passwordEncoder.matches(request.password(), u.getPasswordHash()))
                // E-posta yanlış mı şifre mi — ayırt edilmemeli.
                .orElseThrow(() -> ApiException.unauthorized(
                        "INVALID_CREDENTIALS", "E-posta veya şifre hatalı."));

        // Devre disi hesap once kontrol edilir: dogrulanmamis e-posta mesaji
        // yaniltici olurdu.
        if (user.isDisabled()) {
            throw ApiException.forbidden("ACCOUNT_DISABLED", "Hesabın devre dışı bırakıldı.");
        }

        if (!user.isEmailVerified()) {
            throw ApiException.forbidden("EMAIL_NOT_VERIFIED",
                    "Giriş yapabilmek için önce e-postanı doğrulaman gerekiyor.");
        }

        user.setLastSeenAt(Instant.now());
        return issueTokens(user, userAgent, ip);
    }

    /**
     * Refresh token'ı döndürür (rotasyon). Kullanılmış bir token tekrar
     * gelirse hırsızlık varsayılır ve kullanıcının tüm oturumları kapatılır.
     */
    @Transactional
    public LoginResult refresh(String rawRefreshToken, String userAgent, String ip) {
        RefreshToken stored = refreshTokens.findByTokenHash(SecureTokens.hash(rawRefreshToken))
                .orElseThrow(() -> ApiException.unauthorized(
                        "INVALID_REFRESH_TOKEN", "Oturumun geçersiz. Tekrar giriş yap."));

        if (stored.isRevoked()) {
            log.warn("İptal edilmiş refresh token yeniden kullanıldı, kullanıcı: {}",
                    stored.getUser().getId());
            // Ayrı transaction: aşağıdaki exception bu iptali geri almamalı.
            revoker.revokeAllForUser(stored.getUser());
            throw ApiException.unauthorized("TOKEN_REUSE_DETECTED",
                    "Güvenlik nedeniyle tüm oturumların kapatıldı. Tekrar giriş yap.");
        }

        if (!stored.isUsable()) {
            throw ApiException.unauthorized("INVALID_REFRESH_TOKEN",
                    "Oturumun süresi dolmuş. Tekrar giriş yap.");
        }

        // Devre disi birakilan hesap, elindeki refresh token ile oturumunu
        // uzatamamali; aksi halde 30 gun boyunca erisimi surerdi.
        if (stored.getUser().isDisabled()) {
            revoker.revokeAllForUser(stored.getUser());
            throw ApiException.forbidden("ACCOUNT_DISABLED", "Hesabin devre disi birakildi.");
        }

        stored.revoke();
        return issueTokens(stored.getUser(), userAgent, ip);
    }

    @Transactional
    public void logout(String rawRefreshToken) {
        if (rawRefreshToken == null) {
            return;
        }
        refreshTokens.findByTokenHash(SecureTokens.hash(rawRefreshToken))
                .filter(token -> !token.isRevoked())
                .ifPresent(RefreshToken::revoke);
    }

    private LoginResult issueTokens(User user, String userAgent, String ip) {
        String rawRefresh = SecureTokens.generate();
        Duration refreshTtl = properties.jwt().refreshTokenTtl();

        refreshTokens.save(new RefreshToken(
                user,
                SecureTokens.hash(rawRefresh),
                Instant.now().plus(refreshTtl),
                truncate(userAgent, 255),
                truncate(ip, 45)));

        AuthResponse response = new AuthResponse(
                jwtService.generateAccessToken(user),
                properties.jwt().accessTokenTtl().toSeconds(),
                UserResponse.from(user));

        return new LoginResult(response, rawRefresh, refreshTtl);
    }

    /* --------------------------- Şifre sıfırlama --------------------------- */

    @Transactional
    public void requestPasswordReset(String email) {
        // Kayıtlı olmayan adres için de sessizce başarı döner.
        users.findByEmailIgnoreCase(email).ifPresent(user -> {
            resetTokens.invalidateAllForUser(user, Instant.now());

            String rawToken = SecureTokens.generate();
            resetTokens.save(new PasswordResetToken(
                    user, SecureTokens.hash(rawToken), Instant.now().plus(RESET_TTL)));

            emailSender.sendPasswordResetEmail(
                    user.getEmail(),
                    user.getDisplayName(),
                    buildUrl("/reset-password", rawToken));
        });
    }

    @Transactional
    public void resetPassword(String rawToken, String newPassword) {
        PasswordResetToken token = resetTokens.findByTokenHash(SecureTokens.hash(rawToken))
                .filter(OneTimeToken::isUsable)
                .orElseThrow(() -> ApiException.badRequest(
                        "INVALID_TOKEN", "Sıfırlama bağlantısı geçersiz veya süresi dolmuş."));

        token.markUsed();
        User user = token.getUser();
        user.setPasswordHash(passwordEncoder.encode(newPassword));

        // Şifre değiştiyse çalınmış olabilecek oturumlar da kapatılmalı.
        refreshTokens.revokeAllForUser(user, Instant.now());
    }

    /* ------------------------------ Yardımcı ------------------------------ */

    public Optional<UserResponse> currentUser(AuthenticatedUser principal) {
        return users.findById(principal.id()).map(UserResponse::from);
    }

    private String buildUrl(String path, String rawToken) {
        return properties.appUrl() + path + "?token="
                + URLEncoder.encode(rawToken, StandardCharsets.UTF_8);
    }

    private static String truncate(String value, int max) {
        if (value == null) {
            return null;
        }
        return value.length() <= max ? value : value.substring(0, max);
    }

    /** Servis katmanının çıktısı: gövde + cookie'ye yazılacak refresh token. */
    public record LoginResult(AuthResponse response, String refreshToken, Duration refreshTtl) {
    }
}
