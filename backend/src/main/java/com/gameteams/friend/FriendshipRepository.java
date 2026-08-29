package com.gameteams.friend;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface FriendshipRepository extends JpaRepository<Friendship, UUID> {

    /**
     * Iki kullanici arasindaki iliski, yonu ne olursa olsun. Tek yonu sorgulamak
     * "A zaten B'ye istek gondermis" durumunu kacirir ve cift kayit olusurdu.
     */
    @Query("select f from Friendship f join fetch f.requester join fetch f.addressee "
            + "where (f.requester.id = :a and f.addressee.id = :b) "
            + "   or (f.requester.id = :b and f.addressee.id = :a)")
    Optional<Friendship> findBetween(@Param("a") UUID a, @Param("b") UUID b);

    @Query("select f from Friendship f join fetch f.requester join fetch f.addressee "
            + "where (f.requester.id = :userId or f.addressee.id = :userId) "
            + "and f.status = com.gameteams.friend.FriendshipStatus.ACCEPTED "
            + "order by f.respondedAt desc")
    List<Friendship> findAcceptedFor(@Param("userId") UUID userId);

    /** Kullaniciya gelen, henuz yanitlanmamis istekler. */
    @Query("select f from Friendship f join fetch f.requester join fetch f.addressee "
            + "where f.addressee.id = :userId "
            + "and f.status = com.gameteams.friend.FriendshipStatus.PENDING "
            + "order by f.createdAt desc")
    List<Friendship> findIncomingRequests(@Param("userId") UUID userId);

    /** Kullanicinin gonderdigi, henuz yanitlanmamis istekler. */
    @Query("select f from Friendship f join fetch f.requester join fetch f.addressee "
            + "where f.requester.id = :userId "
            + "and f.status = com.gameteams.friend.FriendshipStatus.PENDING "
            + "order by f.createdAt desc")
    List<Friendship> findOutgoingRequests(@Param("userId") UUID userId);
}
