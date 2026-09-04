package com.gameteams.room;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.gameteams.user.User;

public interface RoomMemberRepository extends JpaRepository<RoomMember, UUID> {

    Optional<RoomMember> findByRoomIdAndUserId(UUID roomId, UUID userId);

    boolean existsByRoomIdAndUserId(UUID roomId, UUID userId);

    long countByRoomId(UUID roomId);

    /** Uye listesi; kullanici tek sorguda cekilir (N+1 onlemi). */
    @Query("select m from RoomMember m join fetch m.user where m.room.id = :roomId order by m.joinedAt")
    List<RoomMember> findAllByRoomIdWithUser(@Param("roomId") UUID roomId);

    /** Kullanicinin odalari; oda ve sahibi tek sorguda gelir. */
    @Query("select m from RoomMember m join fetch m.room r join fetch r.owner "
            + "where m.user = :user order by m.joinedAt")
    List<RoomMember> findAllByUserWithRoom(@Param("user") User user);

    /**
     * Kullanicinin uyesi oldugu odalarin id'leri.
     *
     * Presence yayini icin entity yuklemek gereksiz: WebSocket olay
     * dinleyicisinde her baglanti/kopmada tam RoomMember grafigini cekmek
     * bosa maliyet.
     */
    @Query("select m.room.id from RoomMember m where m.user.id = :userId")
    List<UUID> findRoomIdsByUserId(@Param("userId") UUID userId);
}
