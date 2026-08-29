package com.gameteams.dm;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DmConversationRepository extends JpaRepository<DmConversation, UUID> {

    /** Cift sirali saklandigi icin tek yonlu arama yeterli. */
    @Query("select c from DmConversation c join fetch c.userA join fetch c.userB "
            + "where c.userA.id = :smaller and c.userB.id = :larger")
    Optional<DmConversation> findByOrderedPair(@Param("smaller") UUID smaller,
            @Param("larger") UUID larger);

    @Query("select c from DmConversation c join fetch c.userA join fetch c.userB "
            + "where c.userA.id = :userId or c.userB.id = :userId "
            + "order by c.createdAt desc")
    List<DmConversation> findAllForUser(@Param("userId") UUID userId);

    @Query("select c from DmConversation c join fetch c.userA join fetch c.userB "
            + "where c.id = :id")
    Optional<DmConversation> findByIdWithUsers(@Param("id") UUID id);
}
