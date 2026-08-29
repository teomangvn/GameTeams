package com.gameteams.room;

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

@Entity
@Table(name = "rooms")
public class Room {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false, length = 64)
    private String name;

    @Column(nullable = false, length = 80, unique = true)
    private String slug;

    @Column(length = 300)
    private String description;

    @Column(name = "icon_url")
    private String iconUrl;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @Column(name = "is_public", nullable = false)
    private boolean isPublic;

    @Column(name = "invite_code", nullable = false, length = 32, unique = true)
    private String inviteCode;

    @Column(name = "is_temporary", nullable = false)
    private boolean temporary;

    @Column(name = "max_members", nullable = false)
    private int maxMembers = 100;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected Room() {
    }

    public Room(String name, String slug, String description, User owner, boolean isPublic,
            String inviteCode) {
        this.name = name;
        this.slug = slug;
        this.description = description;
        this.owner = owner;
        this.isPublic = isPublic;
        this.inviteCode = inviteCode;
    }

    @PrePersist
    void onCreate() {
        this.createdAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getSlug() {
        return slug;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getIconUrl() {
        return iconUrl;
    }

    public void setIconUrl(String iconUrl) {
        this.iconUrl = iconUrl;
    }

    public User getOwner() {
        return owner;
    }

    public boolean isPublic() {
        return isPublic;
    }

    public void setPublic(boolean isPublic) {
        this.isPublic = isPublic;
    }

    public String getInviteCode() {
        return inviteCode;
    }

    public void setInviteCode(String inviteCode) {
        this.inviteCode = inviteCode;
    }

    public boolean isTemporary() {
        return temporary;
    }

    public void setTemporary(boolean temporary) {
        this.temporary = temporary;
    }

    public int getMaxMembers() {
        return maxMembers;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
