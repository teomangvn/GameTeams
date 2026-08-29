package com.gameteams.matchmaking;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * Tolerans zamanla genisler: nadir rank'taki oyuncu sonsuza kadar kuyrukta
 * kalmasin, ama ilk saniyelerde eslesme mumkun oldugunca dar tutulsun.
 */
class MatchmakingTicketTest {

    private static MatchmakingTicket ticketCreatedSecondsAgo(long seconds) {
        MatchmakingTicket ticket = new MatchmakingTicket(
                null, null, 2, null, "TR", "tr", Instant.now().plus(15, ChronoUnit.MINUTES));
        ReflectionTestUtils.setField(ticket, "createdAt",
                Instant.now().minusSeconds(seconds));
        return ticket;
    }

    @Test
    void startsAtBaseTolerance() {
        assertThat(ticketCreatedSecondsAgo(0).effectiveTolerance(Instant.now())).isEqualTo(1);
    }

    @Test
    void widensOneStepEveryThirtySeconds() {
        assertThat(ticketCreatedSecondsAgo(29).effectiveTolerance(Instant.now())).isEqualTo(1);
        assertThat(ticketCreatedSecondsAgo(30).effectiveTolerance(Instant.now())).isEqualTo(2);
        assertThat(ticketCreatedSecondsAgo(90).effectiveTolerance(Instant.now())).isEqualTo(4);
    }

    /** Ust sinir olmazsa uzun bekleyen oyuncu her rank ile eslesir. */
    @Test
    void isCappedSoWildlyMismatchedRanksNeverPair() {
        assertThat(ticketCreatedSecondsAgo(3600).effectiveTolerance(Instant.now())).isEqualTo(5);
    }

    @Test
    void tierOrderIsNullWhenRankNotSet() {
        assertThat(ticketCreatedSecondsAgo(0).tierOrder()).isNull();
    }
}
