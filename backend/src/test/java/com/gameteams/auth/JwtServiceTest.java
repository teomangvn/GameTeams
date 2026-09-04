package com.gameteams.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import com.gameteams.config.GameTeamsProperties;
import com.gameteams.user.Role;
import com.gameteams.user.User;

class JwtServiceTest {

	private static final String SECRET = "test-secret-that-is-long-enough-for-hmac-sha-256!!";

	private User user;

	@BeforeEach
	void setUp() {
		user = new User("teoman", "Teoman", "teoman@example.com", "hash");
		// id normalde JPA tarafından atanır.
		ReflectionTestUtils.setField(user, "id", UUID.randomUUID());
	}

	private static JwtService serviceWith(String secret, Duration accessTtl) {
		return new JwtService(new GameTeamsProperties(
				"http://localhost:5173",
				"no-reply@gameteams.local",
				new GameTeamsProperties.Cors(List.of("http://localhost:5173")),
				new GameTeamsProperties.Jwt(secret, accessTtl, Duration.ofDays(30)),
				new GameTeamsProperties.Admin("admin", "", ""),
				new GameTeamsProperties.Webrtc(List.of(), List.of(), "", Duration.ofHours(12)),
				new GameTeamsProperties.Cookie(false, "Lax"),
				new GameTeamsProperties.Uploads("./uploads/avatars", 2_097_152L,
                        "./uploads/attachments", 8_388_608L),
                new GameTeamsProperties.Security(false, java.time.Duration.ofMinutes(10), java.time.Duration.ofDays(90))));
	}

	@Test
	void roundTripsClaims() {
		JwtService service = serviceWith(SECRET, Duration.ofMinutes(15));

		var claims = service.parseAccessToken(service.generateAccessToken(user));

		assertThat(claims).isPresent();
		assertThat(claims.get().userId()).isEqualTo(user.getId());
		assertThat(claims.get().username()).isEqualTo("teoman");
		assertThat(claims.get().role()).isEqualTo(Role.USER);
	}

	@Test
	void rejectsTokenSignedWithAnotherSecret() {
		String foreignToken = serviceWith("a-completely-different-secret-value-32bytes!", Duration.ofMinutes(15))
				.generateAccessToken(user);

		assertThat(serviceWith(SECRET, Duration.ofMinutes(15)).parseAccessToken(foreignToken))
				.isEmpty();
	}

	@Test
	void rejectsTamperedToken() {
		JwtService service = serviceWith(SECRET, Duration.ofMinutes(15));
		String token = service.generateAccessToken(user);

		// Payload'ın son karakterini değiştirmek imzayı geçersiz kılar.
		String tampered = token.substring(0, token.length() - 1)
				+ (token.endsWith("A") ? "B" : "A");

		assertThat(service.parseAccessToken(tampered)).isEmpty();
	}

	@Test
	void rejectsExpiredToken() {
		// Negatif TTL: üretildiği anda süresi dolmuş sayılır.
		JwtService service = serviceWith(SECRET, Duration.ofMinutes(-1));

		assertThat(service.parseAccessToken(service.generateAccessToken(user))).isEmpty();
	}

	@Test
	void rejectsSecretShorterThanHmacMinimum() {
		assertThatThrownBy(() -> serviceWith("kisa", Duration.ofMinutes(15)))
				.isInstanceOf(IllegalStateException.class)
				.hasMessageContaining("32 byte");
	}
}
