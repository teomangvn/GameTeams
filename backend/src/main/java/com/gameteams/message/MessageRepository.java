package com.gameteams.message;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MessageRepository extends JpaRepository<Message, UUID> {

    /**
     * Kanalin son mesajlari (yeniden eskiye). Yazar tek sorguda cekilir.
     */
    @Query("select m from Message m join fetch m.author "
            + "where m.channel.id = :channelId "
            + "order by m.createdAt desc, m.id desc")
    List<Message> findLatest(@Param("channelId") UUID channelId, Limit limit);

    /**
     * Keyset pagination: verilen mesajdan daha eskiler. Offset kullanilmaz;
     * sonsuz scroll sirasinda yeni mesaj gelirse offset kayar ve mesajlar
     * tekrarlanir veya atlanir.
     *
     * (created_at, id) ikilisi ile karsilastirma yapilir; ayni mikrosaniyede
     * yazilmis mesajlar atlanmasin diye id ikincil anahtardir.
     */
    @Query("select m from Message m join fetch m.author "
            + "where m.channel.id = :channelId "
            + "and (m.createdAt < :beforeCreatedAt "
            + "     or (m.createdAt = :beforeCreatedAt and m.id < :beforeId)) "
            + "order by m.createdAt desc, m.id desc")
    List<Message> findBefore(@Param("channelId") UUID channelId,
            @Param("beforeCreatedAt") Instant beforeCreatedAt,
            @Param("beforeId") UUID beforeId,
            Limit limit);

    @Query("select m from Message m join fetch m.author "
            + "left join fetch m.channel left join fetch m.conversation where m.id = :id")
    Optional<Message> findByIdWithAuthorAndTarget(@Param("id") UUID id);

    /** DM gecmisi; kanal sorgularinin birebir esdegeri. */
    @Query("select m from Message m join fetch m.author "
            + "where m.conversation.id = :conversationId "
            + "order by m.createdAt desc, m.id desc")
    List<Message> findLatestInConversation(@Param("conversationId") UUID conversationId, Limit limit);

    @Query("select m from Message m join fetch m.author "
            + "where m.conversation.id = :conversationId "
            + "and (m.createdAt < :beforeCreatedAt "
            + "     or (m.createdAt = :beforeCreatedAt and m.id < :beforeId)) "
            + "order by m.createdAt desc, m.id desc")
    List<Message> findBeforeInConversation(@Param("conversationId") UUID conversationId,
            @Param("beforeCreatedAt") Instant beforeCreatedAt,
            @Param("beforeId") UUID beforeId,
            Limit limit);

    /** DM listesinde son mesaji onizlemek icin. */
    @Query("select m from Message m join fetch m.author "
            + "where m.conversation.id = :conversationId "
            + "order by m.createdAt desc, m.id desc")
    List<Message> findLastInConversation(@Param("conversationId") UUID conversationId, Limit limit);
}
