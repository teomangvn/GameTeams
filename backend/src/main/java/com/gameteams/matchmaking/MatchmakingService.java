package com.gameteams.matchmaking;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.gameteams.common.ApiException;
import com.gameteams.matchmaking.MatchmakingDtos.GameProfileRequest;
import com.gameteams.matchmaking.MatchmakingDtos.GameProfileResponse;
import com.gameteams.matchmaking.MatchmakingDtos.GameSummary;
import com.gameteams.matchmaking.MatchmakingDtos.JoinQueueRequest;
import com.gameteams.matchmaking.MatchmakingDtos.RankSummary;
import com.gameteams.matchmaking.MatchmakingDtos.TicketResponse;
import com.gameteams.user.User;
import com.gameteams.user.UserRepository;

@Service
public class MatchmakingService {

    private static final Logger log = LoggerFactory.getLogger(MatchmakingService.class);
    private static final Duration TICKET_TTL = Duration.ofMinutes(15);

    private final GameRepository games;
    private final GameRankRepository ranks;
    private final UserGameProfileRepository profiles;
    private final MatchmakingTicketRepository tickets;
    private final UserRepository users;

    MatchmakingService(GameRepository games, GameRankRepository ranks,
            UserGameProfileRepository profiles, MatchmakingTicketRepository tickets,
            UserRepository users) {
        this.games = games;
        this.ranks = ranks;
        this.profiles = profiles;
        this.tickets = tickets;
        this.users = users;
    }

    @Transactional(readOnly = true)
    public List<GameSummary> listGames() {
        return games.findAllByActiveTrueOrderByNameAsc().stream()
                .map(game -> new GameSummary(
                        game.getId(), game.getSlug(), game.getName(), game.getIconUrl(),
                        game.getMinTeamSize(), game.getMaxTeamSize(), game.hasRanks(),
                        ranks.findAllByGameIdOrderByTierOrderAsc(game.getId()).stream()
                                .map(RankSummary::from)
                                .toList()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<GameProfileResponse> listProfiles(UUID userId) {
        return profiles.findAllForUser(userId).stream()
                .map(GameProfileResponse::from)
                .toList();
    }

    @Transactional
    public GameProfileResponse upsertProfile(UUID userId, UUID gameId, GameProfileRequest request) {
        Game game = games.findById(gameId)
                .orElseThrow(() -> ApiException.notFound("GAME_NOT_FOUND", "Oyun bulunamadi."));

        UserGameProfile profile = profiles.findForUserAndGame(userId, gameId)
                .orElseGet(() -> new UserGameProfile(users.getReferenceById(userId), game));

        profile.setInGameName(request.inGameName());

        if (request.rankId() != null) {
            GameRank rank = ranks.findById(request.rankId())
                    .orElseThrow(() -> ApiException.badRequest("RANK_NOT_FOUND",
                            "Rank bulunamadi."));
            // Baska oyunun rank'i secilemez; aksi halde kademe kiyaslamasi anlamsiz olur.
            if (!rank.getGame().getId().equals(gameId)) {
                throw ApiException.badRequest("RANK_GAME_MISMATCH",
                        "Secilen rank bu oyuna ait degil.");
            }
            profile.setRank(rank);
        }
        else {
            profile.setRank(null);
        }

        return GameProfileResponse.from(profiles.save(profile));
    }

    /**
     * Kuyruga girer. Rank, bolge ve dil bos birakilirsa oyun profilinden ve
     * hesap ayarlarindan doldurulur -- kullanici her seferinde tekrar
     * secmek zorunda kalmasin.
     */
    @Transactional
    public TicketResponse joinQueue(UUID userId, JoinQueueRequest request) {
        if (tickets.findActiveForUser(userId).isPresent()) {
            throw ApiException.conflict("ALREADY_QUEUED", "Zaten kuyruktasin.");
        }

        Game game = games.findById(request.gameId())
                .filter(Game::isActive)
                .orElseThrow(() -> ApiException.notFound("GAME_NOT_FOUND", "Oyun bulunamadi."));

        if (request.partySize() < game.getMinTeamSize()
                || request.partySize() > game.getMaxTeamSize()) {
            throw ApiException.badRequest("INVALID_PARTY_SIZE",
                    game.getName() + " icin takim boyutu " + game.getMinTeamSize()
                            + "-" + game.getMaxTeamSize() + " arasinda olmali.");
        }

        User user = users.findById(userId)
                .orElseThrow(() -> ApiException.unauthorized("USER_NOT_FOUND", "Hesabin bulunamadi."));

        var profile = profiles.findForUserAndGame(userId, game.getId());

        GameRank rank = null;
        if (request.rankId() != null) {
            rank = ranks.findById(request.rankId())
                    .filter(r -> r.getGame().getId().equals(game.getId()))
                    .orElseThrow(() -> ApiException.badRequest("RANK_NOT_FOUND",
                            "Rank bulunamadi."));
        }
        else {
            rank = profile.map(UserGameProfile::getRank).orElse(null);
        }

        String region = request.region() != null ? request.region() : user.getRegion();
        String language = request.language() != null ? request.language() : user.getLanguage();

        MatchmakingTicket ticket = tickets.save(new MatchmakingTicket(
                user, game, request.partySize(), rank, region, language,
                Instant.now().plus(TICKET_TTL)));

        log.debug("Kuyruga girildi: {} / {} ({} kisi)", user.getUsername(), game.getSlug(),
                request.partySize());
        return toResponse(ticket);
    }

    @Transactional
    public void leaveQueue(UUID userId) {
        tickets.findActiveForUser(userId)
                .orElseThrow(() -> ApiException.notFound("NOT_QUEUED", "Kuyrukta degilsin."))
                .cancel();
    }

    @Transactional(readOnly = true)
    public TicketResponse currentTicket(UUID userId) {
        return tickets.findActiveForUser(userId)
                .map(this::toResponse)
                .orElse(null);
    }

    private TicketResponse toResponse(MatchmakingTicket ticket) {
        return new TicketResponse(
                ticket.getId(),
                ticket.getGame().getId(),
                ticket.getGame().getName(),
                ticket.getPartySize(),
                RankSummary.from(ticket.getRank()),
                ticket.getRegion(),
                ticket.getLanguage(),
                ticket.getStatus(),
                tickets.countWaiting(ticket.getGame().getId(), ticket.getPartySize()),
                ticket.getCreatedAt(),
                ticket.getExpiresAt());
    }
}
