package com.gameteams.config;

import java.util.List;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import com.gameteams.auth.JwtAuthFilter;

@Configuration
public class SecurityConfig {

    private final List<String> allowedOrigins;
    private final JwtAuthFilter jwtAuthFilter;

    SecurityConfig(GameTeamsProperties properties, JwtAuthFilter jwtAuthFilter) {
        this.allowedOrigins = properties.cors().allowedOrigins();
        this.jwtAuthFilter = jwtAuthFilter;
    }

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                // Stateless JWT API: cookie tabanlı oturum yok, dolayısıyla CSRF token'ı da yok.
                // Refresh cookie'si SameSite=Lax ve yalnızca /api/auth yolunda geçerli.
                .csrf(AbstractHttpConfigurer::disable)
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .authorizeHttpRequests(auth -> auth
                        // /api/auth/me kimlik ister; diğer auth uçları açıktır.
                        .requestMatchers("/api/auth/me").authenticated()
                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers("/actuator/health", "/actuator/health/**").permitAll()
                        // Handler bulunamayınca Spring /error'a forward eder ve güvenlik
                        // filtresi ERROR dispatch'ini de kapsar. İzin verilmezse her 404
                        // public uçlarda bile 401'e dönüşür.
                        .requestMatchers("/error").permitAll()
                        // STOMP handshake'i açık; kimlik CONNECT frame'indeki JWT ile doğrulanır.
                        .requestMatchers("/ws/**").permitAll()
                        // Avatar gorselleri <img src> ile cekiliyor ve tarayici o
                        // istekte Authorization basligi gondermez. Dosya adlari
                        // rastgele UUID; sirali tahmin edilemez, gizli veri de yok.
                        .requestMatchers(HttpMethod.GET, "/api/users/avatars/**").permitAll()
                        // Ek dosyalari <img>/<video> ile cekiliyor; ad tahmin
                        // edilemez. Bkz. MessageController#attachment.
                        .requestMatchers(HttpMethod.GET, "/api/attachments/**").permitAll()
                        // E-posta degisikligi onayi: kullanici baglantiya cogu zaman
                        // oturumu acik olmayan bir tarayicida tiklar. Token kanittir.
                        .requestMatchers(HttpMethod.POST, "/api/users/email-change/confirm").permitAll()
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .anyRequest().authenticated())
                // Varsayılan davranış kimliksiz istekte 403 döner; REST istemcisinin
                // "giriş yap" ile "yetkin yok" ayrımını yapabilmesi için 401 gerekir.
                .exceptionHandling(ex -> ex.authenticationEntryPoint(
                        new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(allowedOrigins);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        // Refresh token HttpOnly cookie ile taşındığı için kimlik bilgili istek şart.
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        source.registerCorsConfiguration("/ws/**", config);
        return source;
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }
}
