package com.gameteams.dm;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.HexFormat;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import com.gameteams.user.User;

class DmConversationTest {

    private static User user(String id) {
        User user = new User("u" + id.charAt(0), "U", id.charAt(0) + "@example.com", "hash");
        ReflectionTestUtils.setField(user, "id", UUID.fromString(id));
        return user;
    }

    /** PostgreSQL UUID'leri bayt bayt, isaretsiz karsilastirir; referans olarak bu kullanilir. */
    private static int postgresOrder(UUID a, UUID b) {
        byte[] left = HexFormat.of().parseHex(a.toString().replace("-", ""));
        byte[] right = HexFormat.of().parseHex(b.toString().replace("-", ""));
        return Integer.signum(java.util.Arrays.compareUnsigned(left, right));
    }

    /**
     * Hatanin kendisi: biri 0-7, digeri 8-f ile baslayan kimliklerde Java'nin
     * UUID.compareTo'su veritabaninin tersini soyluyordu.
     */
    @Test
    void siralama_isaret_bitinde_de_veritabaniyla_ayni() {
        UUID low = UUID.fromString("10000000-0000-0000-0000-000000000000");
        UUID high = UUID.fromString("f0000000-0000-0000-0000-000000000000");

        assertThat(low.compareTo(high)).as("Java'nin kendi sirasi ters").isPositive();
        assertThat(DmConversation.compareLikePostgres(low, high)).isNegative();
        assertThat(DmConversation.compareLikePostgres(high, low)).isPositive();
    }

    @Test
    void rastgele_kimliklerde_veritabani_sirasiyla_birebir_ayni() {
        for (int i = 0; i < 10_000; i++) {
            UUID a = UUID.randomUUID();
            UUID b = UUID.randomUUID();
            assertThat(Integer.signum(DmConversation.compareLikePostgres(a, b)))
                    .isEqualTo(postgresOrder(a, b));
        }
    }

    @Test
    void sohbet_kaydi_kullanici_a_kucuk_olacak_sekilde_kurulur() {
        User low = user("70000000-0000-0000-0000-000000000000");
        User high = user("80000000-0000-0000-0000-000000000000");

        for (DmConversation conversation : new DmConversation[] {
                DmConversation.between(low, high), DmConversation.between(high, low) }) {
            assertThat(conversation.getUserA()).isSameAs(low);
            assertThat(conversation.getUserB()).isSameAs(high);
        }
    }
}
