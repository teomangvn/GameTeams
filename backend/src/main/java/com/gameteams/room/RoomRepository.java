package com.gameteams.room;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface RoomRepository extends JpaRepository<Room, UUID> {

    Optional<Room> findByInviteCode(String inviteCode);

    boolean existsBySlug(String slug);
}
