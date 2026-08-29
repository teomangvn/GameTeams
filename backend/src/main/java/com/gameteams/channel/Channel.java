package com.gameteams.channel;

import java.time.Instant;
import java.util.UUID;

import com.gameteams.room.Room;

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
@Table(name = "channels")
public class Channel {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "room_id", nullable = false)
    private Room room;

    @Column(nullable = false, length = 64)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private ChannelType type;

    @Column(length = 300)
    private String topic;

    @Column(nullable = false)
    private int position;

    @Column(name = "user_limit")
    private Integer userLimit;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected Channel() {
    }

    public Channel(Room room, String name, ChannelType type, String topic, int position,
            Integer userLimit) {
        this.room = room;
        this.name = name;
        this.type = type;
        this.topic = topic;
        this.position = position;
        this.userLimit = userLimit;
    }

    @PrePersist
    void onCreate() {
        this.createdAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public Room getRoom() {
        return room;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public ChannelType getType() {
        return type;
    }

    public String getTopic() {
        return topic;
    }

    public void setTopic(String topic) {
        this.topic = topic;
    }

    public int getPosition() {
        return position;
    }

    public void setPosition(int position) {
        this.position = position;
    }

    public Integer getUserLimit() {
        return userLimit;
    }

    public void setUserLimit(Integer userLimit) {
        this.userLimit = userLimit;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
