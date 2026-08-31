package com.gameteams.message;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.gameteams.channel.Channel;
import com.gameteams.channel.ChannelService;
import com.gameteams.common.ApiException;
import com.gameteams.dm.DmConversation;
import com.gameteams.dm.DmService;
import com.gameteams.message.MessageDtos.MessagePage;
import com.gameteams.message.MessageDtos.MessageResponse;
import com.gameteams.user.User;
import com.gameteams.user.UserRepository;

@Service
public class MessageService {

    private static final int PAGE_SIZE = 50;

    private final MessageRepository messages;
    private final ChannelService channelService;
    private final DmService dmService;
    private final UserRepository users;

    MessageService(MessageRepository messages, ChannelService channelService,
            DmService dmService, UserRepository users) {
        this.messages = messages;
        this.channelService = channelService;
        this.dmService = dmService;
        this.users = users;
    }

    /**
     * Kanal gecmisi, yeniden eskiye. cursor null ise en son sayfa doner.
     */
    @Transactional(readOnly = true)
    public MessagePage history(UUID channelId, UUID userId, String cursor) {
        channelService.requireAccessibleChannel(channelId, userId);

        // PAGE_SIZE + 1 cekip fazlaligi atmak, "daha var mi" sorusunu ek sorgu
        // yapmadan cevaplar.
        Limit limit = Limit.of(PAGE_SIZE + 1);
        List<Message> found = cursor == null
                ? messages.findLatest(channelId, limit)
                : decodeAndQuery(channelId, cursor, limit);

        return toPage(found);
    }

    /**
     * Ses kanallari da mesaj tasir: her ses kanalinin kendi sohbeti vardir.
     * Ayri bir "eslesik metin kanali" uretmek yerine kanalin kendisi kullanilir,
     * boylece uyelik ve yetkilendirme tek bir kayit uzerinden yurur.
     */
    @Transactional
    public MessageResponse send(UUID channelId, UUID userId, String content, UUID replyToId) {
        // Erisim kontrolu kanal turune degil oda uyeligine dayanir.
        Channel channel = channelService.requireAccessibleChannel(channelId, userId);

        String trimmed = content.strip();
        if (trimmed.isEmpty()) {
            throw ApiException.badRequest("EMPTY_MESSAGE", "Mesaj bos olamaz.");
        }

        Message replyTo = null;
        if (replyToId != null) {
            replyTo = messages.findById(replyToId)
                    .filter(m -> m.getChannel().getId().equals(channelId))
                    .orElseThrow(() -> ApiException.badRequest(
                            "INVALID_REPLY", "Yanitlanan mesaj bu kanalda degil."));
        }

        // getReferenceById proxy dondurur; DTO'ya cevirme transaction icinde
        // olsa bile alanlara erisim ek sorgu acar. Zaten hepsine ihtiyac var.
        User author = users.findById(userId)
                .orElseThrow(() -> ApiException.unauthorized("USER_NOT_FOUND", "Hesabin bulunamadi."));

        // Esleme burada, transaction icinde yapilir: entity disari sizarsa
        // lazy proxy'ler oturum kapandiktan sonra acilamaz.
        return MessageResponse.from(messages.save(new Message(channel, author, trimmed, replyTo)));
    }

    @Transactional
    public MessageResponse edit(UUID messageId, UUID userId, String content) {
        Message message = requireOwnMessage(messageId, userId);
        if (message.isDeleted()) {
            throw ApiException.badRequest("MESSAGE_DELETED", "Silinmis mesaj duzenlenemez.");
        }
        message.edit(content.strip());
        return MessageResponse.from(message);
    }

    @Transactional
    public MessageResponse delete(UUID messageId, UUID userId) {
        Message message = requireOwnMessage(messageId, userId);
        if (!message.isDeleted()) {
            message.softDelete();
        }
        return MessageResponse.from(message);
    }

    /**
     * Duzenleme ve silme yalnizca mesaj sahibine acik. Oda sahibinin baskasinin
     * mesajini silmesi ayri bir moderasyon yetkisi; kapsam disi birakildi.
     */
    private Message requireOwnMessage(UUID messageId, UUID userId) {
        Message message = messages.findByIdWithAuthorAndTarget(messageId)
                .orElseThrow(() -> ApiException.notFound("MESSAGE_NOT_FOUND", "Mesaj bulunamadi."));

        // Mesaj kanalda da olabilir sohbette de; erisim hangisiyse onun
        // uzerinden dogrulanir.
        if (message.isDirectMessage()) {
            dmService.requireParticipant(message.getConversation().getId(), userId);
        }
        else {
            channelService.requireAccessibleChannel(message.getChannel().getId(), userId);
        }

        if (!message.getAuthor().getId().equals(userId)) {
            throw ApiException.forbidden("NOT_MESSAGE_AUTHOR",
                    "Yalnizca kendi mesajini duzenleyebilir veya silebilirsin.");
        }
        return message;
    }

    private List<Message> decodeAndQuery(UUID channelId, String cursor, Limit limit) {
        Cursor decoded = decodeCursor(cursor);
        return messages.findBefore(channelId, decoded.createdAt(), decoded.id(), limit);
    }

    /**
     * Kanal ve DM ayni sayfalama mantigini paylasir: PAGE_SIZE + 1 cekilir,
     * fazlalik "daha var" isareti olarak kullanilip atilir.
     */
    private MessagePage toPage(List<Message> found) {
        boolean hasMore = found.size() > PAGE_SIZE;
        List<Message> page = hasMore ? found.subList(0, PAGE_SIZE) : found;

        String nextCursor = null;
        if (hasMore) {
            Message last = page.get(page.size() - 1);
            nextCursor = encodeCursor(last.getCreatedAt(), last.getId());
        }

        // Sorgu yeniden eskiye geliyor; istemci eskiden yeniye bekler.
        List<MessageResponse> ordered = new ArrayList<>(page.size());
        for (int i = page.size() - 1; i >= 0; i--) {
            ordered.add(MessageResponse.from(page.get(i)));
        }

        return new MessagePage(ordered, nextCursor);
    }

    private Cursor decodeCursor(String cursor) {
        String decoded;
        try {
            decoded = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
        }
        catch (IllegalArgumentException ex) {
            throw ApiException.badRequest("INVALID_CURSOR", "Sayfalama imleci gecersiz.");
        }

        int separator = decoded.lastIndexOf('|');
        if (separator < 0) {
            throw ApiException.badRequest("INVALID_CURSOR", "Sayfalama imleci gecersiz.");
        }

        try {
            return new Cursor(Instant.parse(decoded.substring(0, separator)),
                    UUID.fromString(decoded.substring(separator + 1)));
        }
        catch (RuntimeException ex) {
            throw ApiException.badRequest("INVALID_CURSOR", "Sayfalama imleci gecersiz.");
        }
    }

    private record Cursor(Instant createdAt, UUID id) {
    }

    /* ------------------------------- DM ---------------------------------- */

    @Transactional(readOnly = true)
    public MessagePage conversationHistory(UUID conversationId, UUID userId, String cursor) {
        dmService.requireParticipant(conversationId, userId);

        Limit limit = Limit.of(PAGE_SIZE + 1);
        List<Message> found = cursor == null
                ? messages.findLatestInConversation(conversationId, limit)
                : decodeAndQueryConversation(conversationId, cursor, limit);

        return toPage(found);
    }

    @Transactional
    public MessageResponse sendDirect(UUID conversationId, UUID userId, String content,
            UUID replyToId) {
        DmConversation conversation = dmService.requireParticipant(conversationId, userId);

        String trimmed = content.strip();
        if (trimmed.isEmpty()) {
            throw ApiException.badRequest("EMPTY_MESSAGE", "Mesaj bos olamaz.");
        }

        Message replyTo = null;
        if (replyToId != null) {
            replyTo = messages.findById(replyToId)
                    .filter(m -> m.getConversation() != null
                            && m.getConversation().getId().equals(conversationId))
                    .orElseThrow(() -> ApiException.badRequest(
                            "INVALID_REPLY", "Yanitlanan mesaj bu sohbette degil."));
        }

        User author = users.findById(userId)
                .orElseThrow(() -> ApiException.unauthorized("USER_NOT_FOUND", "Hesabin bulunamadi."));

        return MessageResponse.from(
                messages.save(new Message(conversation, author, trimmed, replyTo)));
    }

    private List<Message> decodeAndQueryConversation(UUID conversationId, String cursor,
            Limit limit) {
        Cursor decoded = decodeCursor(cursor);
        return messages.findBeforeInConversation(conversationId, decoded.createdAt(),
                decoded.id(), limit);
    }

    private String encodeCursor(Instant createdAt, UUID id) {
        String raw = createdAt.toString() + "|" + id;
        return Base64.getUrlEncoder().withoutPadding()
                .encodeToString(raw.getBytes(StandardCharsets.UTF_8));
    }
}
