package com.gameteams.auth.oauth;

import java.security.SecureRandom;
import java.text.Normalizer;
import java.time.Instant;
import java.util.Locale;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.gameteams.auth.RefreshTokenRepository;
import com.gameteams.user.User;
import com.gameteams.user.UserRepository;

/**
 * Harici hesabi uygulamadaki kullaniciya esler; yoksa yeni kullanici acar.
 *
 * Sira:
 *  1. Bu saglayici kimligi daha once baglanmissa o kullanici.
 *  2. Saglayici e-postayi dogruladiysa ve ayni adresle hesap varsa, o hesaba baglanir.
 *  3. Hic hesap yoksa yeni hesap acilir.
 */
@Service
public class OAuthAccountService {

    private static final Logger log = LoggerFactory.getLogger(OAuthAccountService.class);
    private static final SecureRandom RANDOM = new SecureRandom();

    private static final int USERNAME_MIN = 3;
    /** Sonek icin yer birakilir; sutun 32 karakter. */
    private static final int USERNAME_BASE_MAX = 24;
    private static final int DISPLAY_NAME_MAX = 64;
    private static final int USERNAME_ATTEMPTS = 20;

    private final UserRepository users;
    private final UserIdentityRepository identities;
    private final RefreshTokenRepository refreshTokens;

    OAuthAccountService(UserRepository users, UserIdentityRepository identities,
            RefreshTokenRepository refreshTokens) {
        this.users = users;
        this.identities = identities;
        this.refreshTokens = refreshTokens;
    }

    @Transactional
    public User resolve(OAuthProfile profile) {
        if (profile.subject() == null) {
            throw new OAuthLoginException("PROVIDER_ERROR", "Sağlayıcı kimlik bilgisi göndermedi.");
        }

        var existingIdentity = identities.findByProviderAndSubject(profile.provider(), profile.subject());
        if (existingIdentity.isPresent()) {
            UserIdentity identity = existingIdentity.get();
            identity.recordLogin(profile.email());
            return requireEnabled(identity.getUser());
        }

        if (profile.email() == null) {
            // E-posta hesap kurtarma ve bildirimler icin sart; Facebook'a telefonla
            // kayitli kullanicilarda veya izin reddedilince gelmez.
            throw new OAuthLoginException("EMAIL_REQUIRED",
                    "Hesabından e-posta adresi alınamadı.");
        }

        var sameEmail = users.findByEmailIgnoreCase(profile.email());
        if (sameEmail.isPresent()) {
            User user = sameEmail.get();
            if (!profile.emailTrusted()) {
                throw new OAuthLoginException("ACCOUNT_EXISTS",
                        "Bu e-postayla zaten bir hesap var.");
            }
            link(user, profile);
            return requireEnabled(user);
        }

        User created = new User(uniqueUsername(profile), displayName(profile), profile.email(), null);
        // Saglayici adresi dogruladi (ya da en azindan hesabin sahibinin
        // erisimindeki bir adres); ikinci bir dogrulama maili gereksiz.
        created.setEmailVerified(true);
        users.save(created);
        identities.save(new UserIdentity(created, profile.provider(), profile.subject(), profile.email()));
        log.info("{} ile yeni hesap: {}", profile.provider(), created.getUsername());
        return created;
    }

    /**
     * Mevcut hesaba baglar.
     *
     * Hesap e-postasi hic dogrulanmamissa sifresi silinir ve oturumlari
     * kapatilir. Aksi halde bir saldirgan kurbanin adresiyle once kayit olup
     * sifreyi belirler, kurban Google ile girip adresi "dogrulayinca"
     * saldirganin sifresi de gecerli bir girise donusurdu (hesap on-ele
     * gecirme). Adresin gercek sahibi artik Google ile girer, isterse
     * "sifremi unuttum" ile kendi sifresini koyar.
     */
    private void link(User user, OAuthProfile profile) {
        if (!user.isEmailVerified()) {
            user.setPasswordHash(null);
            user.setEmailVerified(true);
            refreshTokens.revokeAllForUser(user, Instant.now());
            log.warn("Dogrulanmamis hesap {} ile baglandi; sifre ve oturumlar sifirlandi: {}",
                    profile.provider(), user.getUsername());
        }
        identities.save(new UserIdentity(user, profile.provider(), profile.subject(), profile.email()));
        log.info("{} hesabi mevcut kullaniciya baglandi: {}", profile.provider(), user.getUsername());
    }

    private static User requireEnabled(User user) {
        if (user.isDisabled()) {
            throw new OAuthLoginException("ACCOUNT_DISABLED", "Hesabın devre dışı bırakıldı.");
        }
        return user;
    }

    private String uniqueUsername(OAuthProfile profile) {
        String base = usernameBase(profile);
        if (!users.existsByUsernameIgnoreCase(base)) {
            return base;
        }
        for (int attempt = 0; attempt < USERNAME_ATTEMPTS; attempt++) {
            String candidate = base + "_" + (1000 + RANDOM.nextInt(9000));
            if (!users.existsByUsernameIgnoreCase(candidate)) {
                return candidate;
            }
        }
        // Pratikte ulasilmaz; yine de sonsuz donguye girmemek icin.
        return "oyuncu_" + Long.toString(RANDOM.nextLong() & Long.MAX_VALUE, 36).substring(0, 8);
    }

    /**
     * Kullanici adi kayit kuraliyla ayni: harf, rakam, _ . - ve 3-32 karakter.
     * Once e-postanin yerel kismi denenir (genelde kullanicinin alistigi ad),
     * Turkce karakterler sadelestirilir.
     */
    static String usernameBase(OAuthProfile profile) {
        String source = profile.email() != null
                ? profile.email().substring(0, Math.max(0, profile.email().indexOf('@')))
                : profile.name();
        String normalized = Normalizer.normalize(source == null ? "" : source, Normalizer.Form.NFD)
                .replace('ı', 'i')
                .replace('İ', 'I')
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("\\s+", "_")
                .replaceAll("[^a-z0-9_.-]", "")
                .replaceAll("^[_.-]+|[_.-]+$", "");

        if (normalized.length() > USERNAME_BASE_MAX) {
            normalized = normalized.substring(0, USERNAME_BASE_MAX);
        }
        return normalized.length() < USERNAME_MIN ? "oyuncu" : normalized;
    }

    private static String displayName(OAuthProfile profile) {
        String name = profile.name();
        if (name == null) {
            name = profile.email().substring(0, profile.email().indexOf('@'));
        }
        return name.length() > DISPLAY_NAME_MAX ? name.substring(0, DISPLAY_NAME_MAX) : name;
    }
}
