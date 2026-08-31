package com.gameteams.auth;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.gameteams.common.ApiException;
import com.gameteams.config.GameTeamsProperties;
import com.gameteams.mail.EmailSender;
import com.gameteams.user.User;

/**
 * Tanınmayan cihazdan girişte e-posta ile kod doğrulaması.
 *
 * Akış: kimlik doğruysa ama cihaz tanınmıyorsa token üretilmez; 6 haneli bir
 * kod e-postaya gider ve oturum ancak kod doğrulanınca açılır. "Bu cihazı
 * hatırla" işaretlenirse cihaza uzun ömürlü bir çerez yazılır ve bir daha
 * sorulmaz.
 *
 * Kapatma anahtarı bilinçli olarak var: e-posta teslimatı bozulursa (ör. SES
 * sandbox'ında doğrulanmamış adres) bu özellik herkesi kendi hesabından kilitler.
 * DEVICE_VERIFICATION=false ile kapatılıp sunucu yeniden başlatılabilir.
 */
@Service
public class DeviceVerificationService {

    private static final Logger log = LoggerFactory.getLogger(DeviceVerificationService.class);
    private static final SecureRandom RANDOM = new SecureRandom();

    private final LoginChallengeRepository challenges;
    private final TrustedDeviceRepository devices;
    private final EmailSender emailSender;
    private final GameTeamsProperties.Security config;

    DeviceVerificationService(LoginChallengeRepository challenges, TrustedDeviceRepository devices,
            EmailSender emailSender, GameTeamsProperties properties) {
        this.challenges = challenges;
        this.devices = devices;
        this.emailSender = emailSender;
        this.config = properties.security();

        if (!this.config.deviceVerification()) {
            log.warn("Cihaz doğrulaması kapalı: girişler doğrudan kabul edilecek.");
        }
    }

    public boolean isEnabled() {
        return config.deviceVerification();
    }

    /**
     * Çerezdeki token bu kullanıcıya ait geçerli bir cihazı gösteriyor mu?
     * Başka bir kullanıcının token'ı kabul edilmez.
     */
    @Transactional
    public boolean isTrusted(User user, String deviceToken) {
        if (!config.deviceVerification()) {
            return true;
        }
        if (deviceToken == null || deviceToken.isBlank()) {
            return false;
        }

        Optional<TrustedDevice> found = devices.findByTokenHash(SecureTokens.hash(deviceToken));
        if (found.isEmpty()) {
            return false;
        }

        TrustedDevice device = found.get();
        if (!device.isValid() || !device.getUser().getId().equals(user.getId())) {
            return false;
        }

        device.touch();
        return true;
    }

    /** Kod üretir, e-postayla yollar ve doğrulama kaydını döndürür. */
    @Transactional
    public UUID startChallenge(User user, String userAgent, String ip) {
        // 100000-999999: her zaman 6 hane, basta sifir olmaz.
        String code = String.valueOf(100_000 + RANDOM.nextInt(900_000));

        LoginChallenge challenge = new LoginChallenge(
                user,
                SecureTokens.hash(code),
                Instant.now().plus(config.challengeTtl()),
                truncate(userAgent, 512),
                truncate(ip, 64));
        challenges.save(challenge);

        emailSender.sendLoginCodeEmail(user.getEmail(), user.getDisplayName(), code,
                describeDevice(userAgent));

        return challenge.getId();
    }

    /**
     * Kodu doğrular ve kaydı tüketir.
     *
     * Yanlış deneme sayılır: 6 hane kaba kuvvetle denenebilir, sınırsız deneme
     * doğrulamayı anlamsız kılardı.
     */
    @Transactional
    public User completeChallenge(UUID challengeId, String code) {
        LoginChallenge challenge = challenges.findById(challengeId)
                .orElseThrow(() -> ApiException.unauthorized("CHALLENGE_NOT_FOUND",
                        "Doğrulama isteği bulunamadı. Tekrar giriş yap."));

        if (!challenge.isUsable()) {
            throw ApiException.unauthorized("CHALLENGE_EXPIRED",
                    "Kodun süresi doldu veya çok fazla denedin. Tekrar giriş yap.");
        }

        if (!SecureTokens.hash(code.trim()).equals(challenge.getCodeHash())) {
            challenge.recordAttempt();
            throw ApiException.unauthorized("INVALID_CODE", "Kod hatalı.");
        }

        challenge.consume();
        return challenge.getUser();
    }

    /** Cihazı hatırlar ve çereze yazılacak ham token'ı döndürür. */
    @Transactional
    public String trustDevice(User user, String userAgent) {
        String token = SecureTokens.generate();
        devices.save(new TrustedDevice(
                user,
                SecureTokens.hash(token),
                describeDevice(userAgent),
                Instant.now().plus(config.trustTtl())));
        return token;
    }

    public java.time.Duration trustTtl() {
        return config.trustTtl();
    }

    /** E-postada ve cihaz listesinde gösterilecek kaba tarayıcı/sistem özeti. */
    private static String describeDevice(String userAgent) {
        if (userAgent == null || userAgent.isBlank()) {
            return "Bilinmeyen cihaz";
        }

        String browser = userAgent.contains("Firefox") ? "Firefox"
                : userAgent.contains("Edg") ? "Edge"
                : userAgent.contains("Chrome") ? "Chrome"
                : userAgent.contains("Safari") ? "Safari"
                : "Bilinmeyen tarayıcı";

        String system = userAgent.contains("Windows") ? "Windows"
                : userAgent.contains("Android") ? "Android"
                : userAgent.contains("iPhone") || userAgent.contains("iPad") ? "iOS"
                : userAgent.contains("Mac OS") ? "macOS"
                : userAgent.contains("Linux") ? "Linux"
                : "bilinmeyen sistem";

        return browser + " · " + system;
    }

    private static String truncate(String value, int max) {
        if (value == null) {
            return null;
        }
        return value.length() <= max ? value : value.substring(0, max);
    }
}
