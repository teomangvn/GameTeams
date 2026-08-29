package com.gameteams.matchmaking;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public final class MatchmakingDtos {

    private MatchmakingDtos() {
    }

    public record RankSummary(UUID id, String name, int tierOrder) {

        static RankSummary from(GameRank rank) {
            return rank == null ? null
                    : new RankSummary(rank.getId(), rank.getName(), rank.getTierOrder());
        }
    }

    public record GameSummary(
            UUID id,
            String slug,
            String name,
            String iconUrl,
            int minTeamSize,
            int maxTeamSize,
            boolean hasRanks,
            List<RankSummary> ranks) {
    }

    public record GameProfileRequest(
            @Size(max = 64, message = "Oyun ici ad en fazla 64 karakter olabilir.")
            String inGameName,
            UUID rankId) {
    }

    public record GameProfileResponse(
            UUID gameId,
            String gameSlug,
            String gameName,
            String inGameName,
            RankSummary rank) {

        static GameProfileResponse from(UserGameProfile profile) {
            return new GameProfileResponse(
                    profile.getGame().getId(),
                    profile.getGame().getSlug(),
                    profile.getGame().getName(),
                    profile.getInGameName(),
                    RankSummary.from(profile.getRank()));
        }
    }

    public record JoinQueueRequest(
            @NotNull(message = "Oyun secmelisin.") UUID gameId,

            @Min(value = 2, message = "Takim en az 2 kisi olmali.")
            @Max(value = 10, message = "Takim en fazla 10 kisi olabilir.")
            int partySize,

            /** Bos birakilirsa profil ve hesap ayarlarindan doldurulur. */
            UUID rankId,
            String region,
            String language) {
    }

    public record TicketResponse(
            UUID id,
            UUID gameId,
            String gameName,
            int partySize,
            RankSummary rank,
            String region,
            String language,
            TicketStatus status,
            /** Ayni oyun ve takim boyutunda kuyrukta bekleyen toplam kisi. */
            long waitingCount,
            Instant createdAt,
            Instant expiresAt) {
    }

    public record MatchParticipantSummary(
            UUID userId,
            String username,
            String displayName,
            String avatarUrl) {
    }

    public record MatchResponse(
            UUID matchId,
            UUID gameId,
            String gameName,
            int partySize,
            UUID roomId,
            String roomName,
            UUID textChannelId,
            UUID voiceChannelId,
            List<MatchParticipantSummary> participants,
            Instant createdAt) {
    }

    /** /user/queue/matchmaking uzerinden yayinlanir. */
    public record MatchmakingEvent(String type, MatchResponse match) {

        public static MatchmakingEvent found(MatchResponse match) {
            return new MatchmakingEvent("MATCH_FOUND", match);
        }
    }
}
