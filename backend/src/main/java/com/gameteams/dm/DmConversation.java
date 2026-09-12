package com.gameteams.dm;

import java.time.Instant;
import java.util.UUID;

import com.gameteams.user.User;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

/**
 * Ikili sohbet. Kullanici cifti her zaman sirali saklanir (userA.id < userB.id);
 * boylece ayni ikili icin iki ayri konusma olusamaz.
 */
@Entity
@Table(name = "dm_conversations")
public class DmConversation {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_a_id", nullable = false)
    private User userA;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_b_id", nullable = false)
    private User userB;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected DmConversation() {
    }

    /** Siralamayi cagirana birakmamak icin fabrika uzerinden olusturulur. */
    public static DmConversation between(User first, User second) {
        DmConversation conversation = new DmConversation();
        boolean firstIsSmaller = compareLikePostgres(first.getId(), second.getId()) < 0;
        conversation.userA = firstIsSmaller ? first : second;
        conversation.userB = firstIsSmaller ? second : first;
        return conversation;
    }

    /**
     * UUID'leri PostgreSQL'in siraladigi gibi karsilastirir (baytlar isaretsiz).
     *
     * Tablodaki CHECK (user_a_id < user_b_id) kurali veritabaninin sirasini
     * kullanir. Java'nin UUID.compareTo'su ise iki yariyi ISARETLI long olarak
     * karsilastiriyor: 8-f ile baslayan kimligi negatif sayip kucuk goruyor.
     * Kimliklerden biri 0-7, digeri 8-f ile basladiginda Java ile veritabani
     * ters siralama yapiyor, kayit kurala takiliyor ve sohbet hic acilamiyordu.
     * Yalnizca bazi kullanici ciftlerinde hata cikmasinin sebebi buydu.
     */
    public static int compareLikePostgres(UUID a, UUID b) {
        int high = Long.compareUnsigned(a.getMostSignificantBits(), b.getMostSignificantBits());
        return high != 0
                ? high
                : Long.compareUnsigned(a.getLeastSignificantBits(), b.getLeastSignificantBits());
    }

    @PrePersist
    void onCreate() {
        this.createdAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public User getUserA() {
        return userA;
    }

    public User getUserB() {
        return userB;
    }

    public boolean includes(UUID userId) {
        return userA.getId().equals(userId) || userB.getId().equals(userId);
    }

    public User otherThan(UUID userId) {
        return userA.getId().equals(userId) ? userB : userA;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
