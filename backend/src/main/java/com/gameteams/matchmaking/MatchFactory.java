package com.gameteams.matchmaking;

import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.time.ZoneOffset;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.gameteams.auth.SecureTokens;
import com.gameteams.channel.Channel;
import com.gameteams.channel.ChannelRepository;
import com.gameteams.channel.ChannelType;
import com.gameteams.matchmaking.MatchmakingDtos.MatchParticipantSummary;
import com.gameteams.matchmaking.MatchmakingDtos.MatchResponse;
import com.gameteams.matchmaking.MatchmakingDtos.MatchmakingEvent;
import com.gameteams.room.Room;
import com.gameteams.room.RoomMember;
import com.gameteams.room.RoomMemberRepository;
import com.gameteams.room.RoomRepository;
import com.gameteams.room.RoomRole;
import com.gameteams.user.User;

/**
 * Eslesme kuruldugunda gecici odayi acar, katilimcilari uye yapar ve herkese
 * MATCH_FOUND yayinlar.
 */
@Component
public class MatchFactory {

    private static final Logger log = LoggerFactory.getLogger(MatchFactory.class);

    private static final DateTimeFormatter SLUG_TIME =
            DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss").withZone(ZoneOffset.UTC);

    private final MatchRepository matches;
    private final MatchParticipantRepository participants;
    private final RoomRepository rooms;
    private final RoomMemberRepository members;
    private final ChannelRepository channels;
    private final SimpMessagingTemplate broker;

    MatchFactory(MatchRepository matches, MatchParticipantRepository participants,
            RoomRepository rooms, RoomMemberRepository members, ChannelRepository channels,
            SimpMessagingTemplate broker) {
        this.matches = matches;
        this.participants = participants;
        this.rooms = rooms;
        this.members = members;
        this.channels = channels;
        this.broker = broker;
    }

    @Transactional
    public MatchResponse createMatch(Game game, int partySize, String region, String language,
            List<MatchmakingTicket> party) {

        Match match = matches.save(new Match(game, partySize, region, language));

        // Ilk oyuncu odanin sahibi olur; birinin kanal acabilmesi ve odayi
        // kapatabilmesi gerekiyor.
        User owner = party.get(0).getUser();
        Room room = rooms.save(buildRoom(game, owner));
        room.setTemporary(true);

        Channel text = channels.save(
                new Channel(room, "genel", ChannelType.TEXT, game.getName() + " takimi", 0, null));
        Channel voice = channels.save(
                new Channel(room, "Takim Sesi", ChannelType.VOICE, null, 1, partySize));

        List<MatchParticipantSummary> summaries = new java.util.ArrayList<>(party.size());
        for (MatchmakingTicket ticket : party) {
            User user = ticket.getUser();
            members.save(new RoomMember(room, user,
                    user.getId().equals(owner.getId()) ? RoomRole.OWNER : RoomRole.MEMBER));
            participants.save(new MatchParticipant(match, user));
            ticket.markMatched(match);

            summaries.add(new MatchParticipantSummary(user.getId(), user.getUsername(),
                    user.getDisplayName(), user.getAvatarUrl()));
        }

        match.activateWith(room);

        MatchResponse response = new MatchResponse(
                match.getId(), game.getId(), game.getName(), partySize,
                room.getId(), room.getName(), text.getId(), voice.getId(),
                summaries, match.getCreatedAt());

        // Herkes kendi kuyruguna bildirim alir; kuyrukta bekleyen istemci
        // dogrudan odaya yonlenebilsin.
        for (MatchParticipantSummary participant : summaries) {
            broker.convertAndSendToUser(participant.userId().toString(),
                    "/queue/matchmaking", MatchmakingEvent.found(response));
        }

        log.info("Eslesme kuruldu: {} ({} kisi) -> oda {}", game.getSlug(), partySize, room.getId());
        return response;
    }

    private Room buildRoom(Game game, User owner) {
        String name = game.getName() + " Takimi";
        String slug = "match-" + game.getSlug() + "-" + SLUG_TIME.format(Instant.now())
                + "-" + SecureTokens.generate().substring(0, 6).toLowerCase(java.util.Locale.ROOT);

        Room room = new Room(name, slug, "Quick Match ile olusturuldu", owner, false,
                SecureTokens.generate().substring(0, 10));
        room.setTemporary(true);
        return room;
    }
}
