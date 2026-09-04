package com.gameteams.user;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.gameteams.auth.AuthDtos.UserResponse;
import com.gameteams.auth.EmailChangeToken;
import com.gameteams.auth.EmailChangeTokenRepository;
import com.gameteams.auth.OneTimeToken;
import com.gameteams.auth.SecureTokens;
import com.gameteams.common.ApiException;
import com.gameteams.config.GameTeamsProperties;
import com.gameteams.mail.EmailSender;
import com.gameteams.user.UserDtos.UpdateProfileRequest;

/**
 * Kullanıcının kendi profili üzerindeki işlemler.
 *
 * Yanıtlar DTO olarak işlem içinde üretilir; entity döndürmek işlem dışında
 * lazy alanlara erişildiğinde patlamaya yol açar.
 */
@Service
public class UserService {

    /** Doğrulama bağlantısının geçerlilik süresi. */
    private static final Duration EMAIL_CHANGE_TTL = Duration.ofHours(24);

    private final UserRepository users;
    private final AvatarStorage avatars;
    private final EmailChangeTokenRepository emailChangeTokens;
    private final PasswordEncoder passwordEncoder;
    private final EmailSender emailSender;
    private final GameTeamsProperties properties;

    UserService(UserRepository users, AvatarStorage avatars,
            EmailChangeTokenRepository emailChangeTokens, PasswordEncoder passwordEncoder,
            EmailSender emailSender, GameTeamsProperties properties) {
        this.users = users;
        this.avatars = avatars;
        this.emailChangeTokens = emailChangeTokens;
        this.passwordEncoder = passwordEncoder;
        this.emailSender = emailSender;
        this.properties = properties;
    }

    /**
     * E-posta değişikliği başlatır: yeni adrese doğrulama bağlantısı gider.
     *
     * Adres burada değişmez. Yanlış yazılan bir adres anında uygulanırsa hesap
     * kurtarılamaz hale gelirdi -- şifre sıfırlama bağlantısı da o adrese
     * giderdi. Doğrulama, adresin gerçekten kullanıcıya ait olduğunu kanıtlar.
     */
    @Transactional
    public void requestEmailChange(UUID userId, String newEmail, String password) {
        User user = require(userId);

        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw ApiException.unauthorized("INVALID_PASSWORD", "Şifren hatalı.");
        }

        String normalized = newEmail.trim();
        if (normalized.equalsIgnoreCase(user.getEmail())) {
            throw ApiException.badRequest("SAME_EMAIL", "Bu zaten mevcut adresin.");
        }
        if (users.existsByEmailIgnoreCase(normalized)) {
            throw ApiException.conflict("EMAIL_TAKEN", "Bu e-posta zaten kayıtlı.");
        }

        String rawToken = SecureTokens.generate();
        emailChangeTokens.save(new EmailChangeToken(
                user, normalized, SecureTokens.hash(rawToken),
                Instant.now().plus(EMAIL_CHANGE_TTL)));

        emailSender.sendEmailChangeEmail(normalized, user.getDisplayName(),
                properties.appUrl() + "/confirm-email-change?token=" + rawToken);
    }

    /** Bağlantıdaki token'ı doğrular ve adresi uygular. */
    @Transactional
    public void confirmEmailChange(String rawToken) {
        EmailChangeToken token = emailChangeTokens.findByTokenHash(SecureTokens.hash(rawToken))
                .filter(OneTimeToken::isUsable)
                .orElseThrow(() -> ApiException.badRequest("INVALID_TOKEN",
                        "Bağlantı geçersiz veya süresi dolmuş."));

        // Token üretildikten sonra başkası o adresi almış olabilir.
        if (users.existsByEmailIgnoreCase(token.getNewEmail())) {
            throw ApiException.conflict("EMAIL_TAKEN", "Bu e-posta artık kullanılamıyor.");
        }

        token.markUsed();
        token.getUser().setEmail(token.getNewEmail());
    }

    @Transactional
    public UserResponse updateProfile(UUID userId, UpdateProfileRequest request) {
        User user = require(userId);

        user.setDisplayName(request.displayName().trim());
        user.setBio(blankToNull(request.bio()));
        user.setRegion(blankToNull(request.region()));
        user.setLanguage(blankToNull(request.language()));

        return UserResponse.from(user);
    }

    /**
     * Yeni avatarı kaydeder ve eskisini siler.
     *
     * Dosya işlemden önce yazılır: yazma başarısız olursa veritabanına
     * dokunulmamış olur. Eski dosya ancak yeni URL kaydedildikten sonra
     * silinir, böylece yarıda kalan bir işlem kullanıcıyı avatarsız bırakmaz.
     */
    @Transactional
    public UserResponse updateAvatar(UUID userId, MultipartFile file) {
        User user = require(userId);
        String previous = user.getAvatarUrl();

        user.setAvatarUrl(avatars.store(file));
        UserResponse response = UserResponse.from(user);

        avatars.deleteByUrl(previous);
        return response;
    }

    @Transactional
    public UserResponse removeAvatar(UUID userId) {
        User user = require(userId);
        String previous = user.getAvatarUrl();

        user.setAvatarUrl(null);
        UserResponse response = UserResponse.from(user);

        avatars.deleteByUrl(previous);
        return response;
    }

    private User require(UUID userId) {
        return users.findById(userId)
                .orElseThrow(() -> ApiException.notFound("USER_NOT_FOUND", "Hesabın bulunamadı."));
    }

    /** Boş bırakılan alanlar null saklanır; "" ile null ayrımı kullanıcı için anlamsız. */
    private static String blankToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
