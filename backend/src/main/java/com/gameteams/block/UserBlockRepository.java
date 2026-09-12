package com.gameteams.block;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserBlockRepository extends JpaRepository<UserBlock, UUID> {

    /** Taraflardan biri digerini engellemis mi; iletisim kurallari icin yon onemsiz. */
    @Query("select count(b) > 0 from UserBlock b "
            + "where (b.blocker.id = :a and b.blocked.id = :b) "
            + "   or (b.blocker.id = :b and b.blocked.id = :a)")
    boolean existsEitherWay(@Param("a") UUID a, @Param("b") UUID b);

    @Query("select count(b) > 0 from UserBlock b "
            + "where b.blocker.id = :blockerId and b.blocked.id = :blockedId")
    boolean hasBlocked(@Param("blockerId") UUID blockerId, @Param("blockedId") UUID blockedId);

    @Query("select b from UserBlock b "
            + "where b.blocker.id = :blockerId and b.blocked.id = :blockedId")
    Optional<UserBlock> find(@Param("blockerId") UUID blockerId, @Param("blockedId") UUID blockedId);

    @Query("select b from UserBlock b join fetch b.blocked "
            + "where b.blocker.id = :blockerId order by b.createdAt desc")
    List<UserBlock> findAllByBlocker(@Param("blockerId") UUID blockerId);
}
