package com.gameteams.message;

import java.time.Instant;
import java.util.UUID;

import com.gameteams.channel.Channel;
import com.gameteams.dm.DmConversation;
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
@Table(name = "messages")
public class Message {

    @Id
    @GeneratedValue
    private UUID id;

    /**
     * Kanal mesaji ise dolu, DM ise null. Veritabani kisiti tam olarak birinin
     * dolu olmasini garanti eder (messages_target_check).
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "channel_id")
    private Channel channel;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "conversation_id")
    private DmConversation conversation;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_id", nullable = false)
    private User author;

    @Column(nullable = false, columnDefinition = "text")
    private String content;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reply_to_id")
    private Message replyTo;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "edited_at")
    private Instant editedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    protected Message() {
    }

    public Message(Channel channel, User author, String content, Message replyTo) {
        this.channel = channel;
        this.author = author;
        this.content = content;
        this.replyTo = replyTo;
    }

    public Message(DmConversation conversation, User author, String content, Message replyTo) {
        this.conversation = conversation;
        this.author = author;
        this.content = content;
        this.replyTo = replyTo;
    }

    @PrePersist
    void onCreate() {
        this.createdAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public Channel getChannel() {
        return channel;
    }

    public DmConversation getConversation() {
        return conversation;
    }

    public boolean isDirectMessage() {
        return conversation != null;
    }

    public User getAuthor() {
        return author;
    }

    public String getContent() {
        return content;
    }

    /** Icerigi degistirir ve duzenlenme damgasini basar. */
    public void edit(String content) {
        this.content = content;
        this.editedAt = Instant.now();
    }

    /**
     * Yumusak silme: kayit durur, icerik istemciye gizlenir. Yanit zinciri
     * (reply_to) kirilmasin diye satir gercekten silinmez.
     */
    public void softDelete() {
        this.deletedAt = Instant.now();
        this.content = "";
    }

    public boolean isDeleted() {
        return deletedAt != null;
    }

    public Message getReplyTo() {
        return replyTo;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getEditedAt() {
        return editedAt;
    }

    public Instant getDeletedAt() {
        return deletedAt;
    }
}
