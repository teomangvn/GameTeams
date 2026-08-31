package com.gameteams.message;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Limit;
import org.springframework.test.util.ReflectionTestUtils;

import com.gameteams.channel.Channel;
import com.gameteams.channel.ChannelService;
import com.gameteams.channel.ChannelType;
import com.gameteams.common.ApiException;
import com.gameteams.room.Room;
import com.gameteams.user.User;
import com.gameteams.user.UserRepository;

@ExtendWith(MockitoExtension.class)
class MessageServiceTest {

    @Mock
    private MessageRepository messages;

    @Mock
    private ChannelService channelService;

    @Mock
    private com.gameteams.dm.DmService dmService;

    @Mock
    private UserRepository users;

    @InjectMocks
    private MessageService messageService;

    private UUID channelId;
    private UUID userId;
    private User author;
    private Channel textChannel;

    @BeforeEach
    void setUp() {
        channelId = UUID.randomUUID();
        userId = UUID.randomUUID();

        author = new User("teoman", "Teoman", "teoman@example.com", "hash");
        ReflectionTestUtils.setField(author, "id", userId);

        Room room = new Room("Oda", "oda-abc", null, author, false, "INVITE1234");
        textChannel = new Channel(room, "genel", ChannelType.TEXT, null, 0, null);
        ReflectionTestUtils.setField(textChannel, "id", channelId);
    }

    private Message persisted(String content) {
        Message message = new Message(textChannel, author, content, null);
        ReflectionTestUtils.setField(message, "id", UUID.randomUUID());
        ReflectionTestUtils.setField(message, "createdAt", Instant.now());
        return message;
    }

    /**
     * Her ses kanalinin kendi sohbeti var: ayri bir eslesik metin kanali
     * uretmek yerine kanalin kendisi mesaj tasiyor. Erisim kontrolu kanal
     * turune degil oda uyeligine dayandigi icin yetkilendirme degismiyor.
     */
    @Test
    void sendAcceptsVoiceChannels() {
        Room room = textChannel.getRoom();
        Channel voice = new Channel(room, "Ses", ChannelType.VOICE, null, 1, 6);
        ReflectionTestUtils.setField(voice, "id", channelId);

        when(channelService.requireAccessibleChannel(channelId, userId)).thenReturn(voice);
        when(users.findById(userId)).thenReturn(Optional.of(author));
        when(messages.save(any(Message.class))).thenAnswer(invocation -> {
            Message saved = invocation.getArgument(0);
            ReflectionTestUtils.setField(saved, "id", UUID.randomUUID());
            ReflectionTestUtils.setField(saved, "createdAt", Instant.now());
            return saved;
        });

        var sent = messageService.send(channelId, userId, "merhaba", null);

        assertThat(sent.content()).isEqualTo("merhaba");
    }

    @Test
    void sendRejectsWhitespaceOnlyContent() {
        when(channelService.requireAccessibleChannel(channelId, userId)).thenReturn(textChannel);

        assertThatThrownBy(() -> messageService.send(channelId, userId, "    ", null))
                .isInstanceOf(ApiException.class)
                .extracting(ex -> ((ApiException) ex).code())
                .isEqualTo("EMPTY_MESSAGE");
    }

    /** Yanit zinciri kanallar arasi kurulamamali. */
    @Test
    void replyMustBelongToSameChannel() {
        when(channelService.requireAccessibleChannel(channelId, userId)).thenReturn(textChannel);

        Room otherRoom = new Room("Diger", "diger-xyz", null, author, false, "INVITE5678");
        Channel otherChannel = new Channel(otherRoom, "genel", ChannelType.TEXT, null, 0, null);
        ReflectionTestUtils.setField(otherChannel, "id", UUID.randomUUID());

        Message foreign = new Message(otherChannel, author, "baska kanaldan", null);
        UUID foreignId = UUID.randomUUID();
        ReflectionTestUtils.setField(foreign, "id", foreignId);
        when(messages.findById(foreignId)).thenReturn(Optional.of(foreign));

        assertThatThrownBy(() -> messageService.send(channelId, userId, "yanit", foreignId))
                .isInstanceOf(ApiException.class)
                .extracting(ex -> ((ApiException) ex).code())
                .isEqualTo("INVALID_REPLY");
    }

    @Test
    void editIsRejectedForOtherPeoplesMessages() {
        User someoneElse = new User("kaan", "Kaan", "kaan@example.com", "hash");
        ReflectionTestUtils.setField(someoneElse, "id", UUID.randomUUID());

        Message message = new Message(textChannel, someoneElse, "benim mesajim", null);
        UUID messageId = UUID.randomUUID();
        ReflectionTestUtils.setField(message, "id", messageId);

        when(messages.findByIdWithAuthorAndTarget(messageId)).thenReturn(Optional.of(message));
        when(channelService.requireAccessibleChannel(channelId, userId)).thenReturn(textChannel);

        assertThatThrownBy(() -> messageService.edit(messageId, userId, "degistir"))
                .isInstanceOf(ApiException.class)
                .extracting(ex -> ((ApiException) ex).code())
                .isEqualTo("NOT_MESSAGE_AUTHOR");
    }

    @Test
    void deletedMessageCannotBeEdited() {
        Message message = persisted("silinecek");
        message.softDelete();
        UUID messageId = message.getId();

        when(messages.findByIdWithAuthorAndTarget(messageId)).thenReturn(Optional.of(message));
        when(channelService.requireAccessibleChannel(channelId, userId)).thenReturn(textChannel);

        assertThatThrownBy(() -> messageService.edit(messageId, userId, "yeni"))
                .isInstanceOf(ApiException.class)
                .extracting(ex -> ((ApiException) ex).code())
                .isEqualTo("MESSAGE_DELETED");
    }

    /** Sorgu yeniden eskiye gelir; istemciye eskiden yeniye verilmeli. */
    @Test
    void historyReturnsOldestFirst() {
        when(channelService.requireAccessibleChannel(channelId, userId)).thenReturn(textChannel);

        Message older = persisted("once");
        Message newer = persisted("sonra");
        when(messages.findLatest(eq(channelId), any(Limit.class)))
                .thenReturn(List.of(newer, older));

        var page = messageService.history(channelId, userId, null);

        assertThat(page.messages()).extracting(m -> m.content()).containsExactly("once", "sonra");
        assertThat(page.nextCursor()).isNull();
    }

    @Test
    void malformedCursorIsRejected() {
        when(channelService.requireAccessibleChannel(channelId, userId)).thenReturn(textChannel);

        assertThatThrownBy(() -> messageService.history(channelId, userId, "!!!bozuk!!!"))
                .isInstanceOf(ApiException.class)
                .extracting(ex -> ((ApiException) ex).code())
                .isEqualTo("INVALID_CURSOR");
    }
}
