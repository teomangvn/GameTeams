package com.gameteams.auth;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class SecureTokensTest {

	@Test
	void generatesDistinctUrlSafeTokens() {
		String first = SecureTokens.generate();
		String second = SecureTokens.generate();

		assertThat(first).isNotEqualTo(second);
		// URL'e gömüleceği için +, / ve = içermemeli.
		assertThat(first).matches("^[A-Za-z0-9_-]+$");
	}

	@Test
	void hashIsDeterministicAndFitsSchemaColumn() {
		String token = SecureTokens.generate();

		String hash = SecureTokens.hash(token);

		assertThat(hash).isEqualTo(SecureTokens.hash(token));
		// Şemadaki VARCHAR(64) ile birebir uyumlu olmalı.
		assertThat(hash).hasSize(64).matches("^[0-9a-f]{64}$");
	}

	@Test
	void differentTokensProduceDifferentHashes() {
		assertThat(SecureTokens.hash("a")).isNotEqualTo(SecureTokens.hash("b"));
	}
}
