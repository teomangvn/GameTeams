package com.gameteams.channel;

import java.time.Instant;
import java.util.UUID;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class ChannelDtos {

    private ChannelDtos() {
    }

    public record CreateChannelRequest(
            @NotBlank(message = "Kanal adi zorunlu.")
            @Size(min = 1, max = 64, message = "Kanal adi 1-64 karakter olmali.")
            @Pattern(regexp = "^[^#@]+$",
                    message = "Kanal adi # veya @ karakteri iceremez.")
            String name,

            @NotNull(message = "Kanal turu zorunlu.")
            ChannelType type,

            @Size(max = 300, message = "Konu en fazla 300 karakter olabilir.")
            String topic,

            /** Yalnizca ses kanallari icin. Mesh WebRTC 8 kisiden sonra pratik degil. */
            @Min(value = 2, message = "Kullanici siniri en az 2 olmali.")
            @Max(value = 8, message = "Mesh ses kanali en fazla 8 kisi destekler.")
            Integer userLimit) {
    }

    public record UpdateChannelRequest(
            @Size(min = 1, max = 64, message = "Kanal adi 1-64 karakter olmali.")
            String name,

            @Size(max = 300, message = "Konu en fazla 300 karakter olabilir.")
            String topic,

            @Min(value = 2, message = "Kullanici siniri en az 2 olmali.")
            @Max(value = 8, message = "Mesh ses kanali en fazla 8 kisi destekler.")
            Integer userLimit) {
    }

    public record ChannelResponse(
            UUID id,
            UUID roomId,
            String name,
            ChannelType type,
            String topic,
            int position,
            Integer userLimit,
            Instant createdAt) {

        public static ChannelResponse from(Channel channel) {
            return new ChannelResponse(
                    channel.getId(),
                    channel.getRoom().getId(),
                    channel.getName(),
                    channel.getType(),
                    channel.getTopic(),
                    channel.getPosition(),
                    channel.getUserLimit(),
                    channel.getCreatedAt());
        }
    }
}
