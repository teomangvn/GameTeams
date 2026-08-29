package com.gameteams.admin;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.gameteams.config.GameTeamsProperties;
import com.gameteams.user.Role;
import com.gameteams.user.User;
import com.gameteams.user.UserRepository;

/**
 * Geliştirme kolaylığı için açılışta admin hesabı oluşturur.
 *
 * Değerler .env'den gelir (repoda değil). ADMIN_PASSWORD boşsa hiçbir şey
 * yapılmaz — prod'da değişken tanımlanmayarak seeder devre dışı bırakılır.
 * Hesap zaten varsa dokunulmaz, yani şifre elle değiştirilmişse ezilmez.
 */
@Component
public class AdminUserSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminUserSeeder.class);

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final GameTeamsProperties properties;

    AdminUserSeeder(UserRepository users, PasswordEncoder passwordEncoder,
            GameTeamsProperties properties) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.properties = properties;
    }

    @Override
    @Transactional
    public void run(String... args) {
        var admin = properties.admin();
        if (admin == null || admin.password() == null || admin.password().isBlank()
                || admin.email() == null || admin.email().isBlank()) {
            log.debug("ADMIN_PASSWORD/ADMIN_EMAIL tanımlı değil, admin seed atlandı.");
            return;
        }

        if (users.existsByEmailIgnoreCase(admin.email())) {
            log.debug("Admin hesabı zaten var: {}", admin.email());
            return;
        }

        User user = new User(
                admin.username(),
                admin.username(),
                admin.email(),
                passwordEncoder.encode(admin.password()));
        user.setRole(Role.ADMIN);
        // Doğrulama adımını atlar; dev'de mail kutusuna gitmeye gerek kalmaz.
        user.setEmailVerified(true);
        users.save(user);

        log.info("Admin hesabı oluşturuldu: {} ({})", admin.username(), admin.email());
    }
}
