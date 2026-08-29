package com.gameteams.room;

import java.util.Optional;
import java.util.UUID;

import java.time.Instant;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RoomRepository extends JpaRepository<Room, UUID> {

    Optional<Room> findByInviteCode(String inviteCode);

    boolean existsBySlug(String slug);

    long countByTemporaryTrue();

    /** Temizlik isi icin: belirtilen andan once acilmis gecici odalar. */
    @Query("select r from Room r where r.temporary = true and r.createdAt < :cutoff")
    List<Room> findTemporaryCreatedBefore(@Param("cutoff") Instant cutoff);
}
