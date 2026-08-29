package com.gameteams.room;

import java.time.Instant;
import java.util.UUID;

import com.gameteams.user.User;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "room_members")
public class RoomMember {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "room_id", nullable = false)
    private Room room;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private RoomRole role = RoomRole.MEMBER;

    @Column(length = 64)
    private String nickname;

    @Column(name = "joined_at", nullable = false)
    private Instant joinedAt;

    protected RoomMember() {
    }

    public RoomMember(Room room, User user, RoomRole role) {
        this.room = room;
        this.user = user;
        this.role = role;
    }

    @PrePersist
    void onCreate() {
        this.joinedAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public Room getRoom() {
        return room;
    }

    public User getUser() {
        return user;
    }

    public RoomRole getRole() {
        return role;
    }

    public boolean isOwner() {
        return role == RoomRole.OWNER;
    }

    public String getNickname() {
        return nickname;
    }

    public void setNickname(String nickname) {
        this.nickname = nickname;
    }

    public Instant getJoinedAt() {
        return joinedAt;
    }
}
