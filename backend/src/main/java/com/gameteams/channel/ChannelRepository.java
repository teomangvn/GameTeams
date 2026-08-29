package com.gameteams.channel;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ChannelRepository extends JpaRepository<Channel, UUID> {

    List<Channel> findAllByRoomIdOrderByPositionAscCreatedAtAsc(UUID roomId);

    boolean existsByRoomIdAndName(UUID roomId, String name);

    /** Yeni kanal listenin sonuna eklenir. */
    @Query("select coalesce(max(c.position), -1) from Channel c where c.room.id = :roomId")
    int findMaxPosition(@Param("roomId") UUID roomId);

    /** Kanal ile odasini tek sorguda ceker; yetki kontrolu odaya bagli. */
    @Query("select c from Channel c join fetch c.room where c.id = :id")
    Optional<Channel> findByIdWithRoom(@Param("id") UUID id);
}
