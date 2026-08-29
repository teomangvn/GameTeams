package com.gameteams.matchmaking;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
interface GameRepository extends JpaRepository<Game, UUID> {

    List<Game> findAllByActiveTrueOrderByNameAsc();

    Optional<Game> findBySlug(String slug);
}

@Repository
interface GameRankRepository extends JpaRepository<GameRank, UUID> {

    List<GameRank> findAllByGameIdOrderByTierOrderAsc(UUID gameId);
}

@Repository
interface UserGameProfileRepository extends JpaRepository<UserGameProfile, UUID> {

    @Query("select p from UserGameProfile p join fetch p.game left join fetch p.rank "
            + "where p.user.id = :userId")
    List<UserGameProfile> findAllForUser(@Param("userId") UUID userId);

    @Query("select p from UserGameProfile p left join fetch p.rank "
            + "where p.user.id = :userId and p.game.id = :gameId")
    Optional<UserGameProfile> findForUserAndGame(@Param("userId") UUID userId,
            @Param("gameId") UUID gameId);
}

@Repository
interface MatchRepository extends JpaRepository<Match, UUID> {
}

@Repository
interface MatchParticipantRepository extends JpaRepository<MatchParticipant, UUID> {

    @Query("select p from MatchParticipant p join fetch p.user where p.match.id = :matchId")
    List<MatchParticipant> findAllByMatchId(@Param("matchId") UUID matchId);
}

@Repository
interface MatchmakingTicketRepository extends JpaRepository<MatchmakingTicket, UUID> {

    @Query("select t from MatchmakingTicket t join fetch t.game left join fetch t.rank "
            + "left join fetch t.match "
            + "where t.user.id = :userId and t.status = com.gameteams.matchmaking.TicketStatus.QUEUED")
    Optional<MatchmakingTicket> findActiveForUser(@Param("userId") UUID userId);

    /**
     * Eslestiricinin taradigi kuyruk. Bilet sahibi ve rank tek sorguda gelir;
     * her bilet icin ayri sorgu eslestirmeyi yavaslatirdi.
     */
    @Query("select t from MatchmakingTicket t "
            + "join fetch t.user join fetch t.game left join fetch t.rank "
            + "where t.status = com.gameteams.matchmaking.TicketStatus.QUEUED "
            + "and t.expiresAt > :now "
            + "order by t.createdAt asc")
    List<MatchmakingTicket> findQueued(@Param("now") Instant now);

    @Query("select count(t) from MatchmakingTicket t "
            + "where t.status = com.gameteams.matchmaking.TicketStatus.QUEUED "
            + "and t.game.id = :gameId and t.partySize = :partySize")
    long countWaiting(@Param("gameId") UUID gameId, @Param("partySize") int partySize);

    @Query("select t from MatchmakingTicket t "
            + "where t.status = com.gameteams.matchmaking.TicketStatus.QUEUED "
            + "and t.expiresAt <= :now")
    List<MatchmakingTicket> findExpired(@Param("now") Instant now);
}
