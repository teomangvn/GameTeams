package com.gameteams.channel;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.gameteams.channel.ChannelDtos.ChannelResponse;
import com.gameteams.channel.ChannelDtos.CreateChannelRequest;
import com.gameteams.channel.ChannelDtos.UpdateChannelRequest;
import com.gameteams.common.ApiException;
import com.gameteams.room.RoomService;

@Service
public class ChannelService {

    private final ChannelRepository channels;
    private final RoomService roomService;

    ChannelService(ChannelRepository channels, RoomService roomService) {
        this.channels = channels;
        this.roomService = roomService;
    }

    /**
     * Kanal erisimi her zaman odaya uyelik uzerinden dogrulanir; kanal id
     * bilmek tek basina erisim hakki vermez.
     */
    @Transactional(readOnly = true)
    public Channel requireAccessibleChannel(UUID channelId, UUID userId) {
        Channel channel = channels.findByIdWithRoom(channelId)
                .orElseThrow(() -> ApiException.notFound("CHANNEL_NOT_FOUND", "Kanal bulunamadi."));
        roomService.requireMember(channel.getRoom().getId(), userId);
        return channel;
    }

    @Transactional(readOnly = true)
    public List<ChannelResponse> listByRoom(UUID roomId, UUID userId) {
        roomService.requireMember(roomId, userId);
        return channels.findAllByRoomIdOrderByPositionAscCreatedAtAsc(roomId).stream()
                .map(ChannelResponse::from)
                .toList();
    }

    @Transactional
    public ChannelResponse create(UUID roomId, UUID userId, CreateChannelRequest request) {
        var member = roomService.requireOwner(roomId, userId);

        String name = request.name().trim();
        if (channels.existsByRoomIdAndName(roomId, name)) {
            throw ApiException.conflict("CHANNEL_NAME_TAKEN",
                    "Bu odada ayni isimde bir kanal zaten var.");
        }

        // Kullanici siniri yalnizca ses kanallarinda anlamli; metin kanalinda
        // gonderilse bile yok sayilir.
        Integer userLimit = request.type() == ChannelType.VOICE
                ? (request.userLimit() != null ? request.userLimit() : 6)
                : null;

        Channel channel = new Channel(
                member.getRoom(),
                name,
                request.type(),
                request.topic(),
                channels.findMaxPosition(roomId) + 1,
                userLimit);

        return ChannelResponse.from(channels.save(channel));
    }

    @Transactional
    public ChannelResponse update(UUID channelId, UUID userId, UpdateChannelRequest request) {
        Channel channel = channels.findByIdWithRoom(channelId)
                .orElseThrow(() -> ApiException.notFound("CHANNEL_NOT_FOUND", "Kanal bulunamadi."));
        roomService.requireOwner(channel.getRoom().getId(), userId);

        if (request.name() != null) {
            String name = request.name().trim();
            if (!name.equals(channel.getName())
                    && channels.existsByRoomIdAndName(channel.getRoom().getId(), name)) {
                throw ApiException.conflict("CHANNEL_NAME_TAKEN",
                        "Bu odada ayni isimde bir kanal zaten var.");
            }
            channel.setName(name);
        }
        if (request.topic() != null) {
            channel.setTopic(request.topic());
        }
        if (request.userLimit() != null && channel.getType() == ChannelType.VOICE) {
            channel.setUserLimit(request.userLimit());
        }

        return ChannelResponse.from(channel);
    }

    @Transactional
    public void delete(UUID channelId, UUID userId) {
        Channel channel = channels.findByIdWithRoom(channelId)
                .orElseThrow(() -> ApiException.notFound("CHANNEL_NOT_FOUND", "Kanal bulunamadi."));
        UUID roomId = channel.getRoom().getId();
        roomService.requireOwner(roomId, userId);

        // Odanin son kanali silinirse kullanilamaz hale gelir.
        if (channels.findAllByRoomIdOrderByPositionAscCreatedAtAsc(roomId).size() <= 1) {
            throw ApiException.badRequest("LAST_CHANNEL",
                    "Odanin son kanali silinemez.");
        }
        channels.delete(channel);
    }
}
