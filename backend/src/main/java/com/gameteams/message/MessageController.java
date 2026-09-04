package com.gameteams.message;

import java.util.UUID;
import com.gameteams.common.ApiException;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.http.ResponseEntity;
import org.springframework.http.MediaType;
import org.springframework.http.HttpHeaders;
import org.springframework.http.CacheControl;
import org.springframework.core.io.Resource;
import org.springframework.core.io.FileSystemResource;
import java.time.Duration;
import java.nio.file.Path;
import java.nio.file.Files;
import java.io.IOException;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.gameteams.auth.AuthenticatedUser;
import com.gameteams.message.MessageDtos.ChannelEvent;
import com.gameteams.message.MessageDtos.EditMessageRequest;
import com.gameteams.message.MessageDtos.MessagePage;
import com.gameteams.message.MessageDtos.MessageResponse;
import com.gameteams.message.MessageDtos.SendMessageRequest;

import jakarta.validation.Valid;

/**
 * Mesaj gecmisi ve duzenleme/silme REST uzerinden; canli yayin STOMP ile.
 * Gonderme hem REST hem STOMP ile yapilabilir - REST, WebSocket kurulamayan
 * ortamlar icin yedek yoldur.
 */
@RestController
public class MessageController {

    private final MessageService messageService;
    private final SimpMessagingTemplate broker;

    private final AttachmentStorage attachments;

    MessageController(MessageService messageService, SimpMessagingTemplate broker,
            AttachmentStorage attachments) {
        this.messageService = messageService;
        this.broker = broker;
        this.attachments = attachments;
    }

    @GetMapping("/api/channels/{channelId}/messages")
    MessagePage history(@AuthenticationPrincipal AuthenticatedUser me,
            @PathVariable UUID channelId,
            @RequestParam(required = false) String cursor) {
        return messageService.history(channelId, me.id(), cursor);
    }

    @PostMapping("/api/channels/{channelId}/messages")
    MessageResponse send(@AuthenticationPrincipal AuthenticatedUser me,
            @PathVariable UUID channelId,
            @Valid @RequestBody SendMessageRequest request) {
        MessageResponse message = messageService.send(channelId, me.id(), request.content(),
                request.replyToId());
        broadcast(channelId, ChannelEvent.created(message));
        return message;
    }

    /**
     * Dosya ekli mesaj. Ayri bir uc: JSON govde ile multipart ayni istekte
     * tasinamaz ve mevcut uca dokunmak butun cagiranlari etkilerdi.
     */
    @PostMapping("/api/channels/{channelId}/messages/upload")
    MessageResponse sendWithAttachment(@AuthenticationPrincipal AuthenticatedUser me,
            @PathVariable UUID channelId,
            @RequestParam(required = false) String content,
            @RequestParam("file") MultipartFile file) {

        MessageResponse message = messageService.send(channelId, me.id(), content, null, file);
        broadcast(channelId, ChannelEvent.created(message));
        return message;
    }

    /**
     * Ek dosyasini servis eder.
     *
     * Kimlik gerektirmez: tarayici <img> ve <video> isteklerinde Authorization
     * basligi gondermez. Erisim, dosya adinin tahmin edilemezligine dayanir
     * (128 bitlik rastgele ad). Bu, sohbet iceriginin baglantiyi ele geciren
     * birine acik olmasi demektir; kanal uyeligini zorunlu kilmak icin imzali
     * URL veya cerez tabanli dogrulama gerekir. Simdilik bilincli bir takas.
     */
    @GetMapping("/api/attachments/{storedName}")
    ResponseEntity<Resource> attachment(@PathVariable String storedName) {
        Path path = attachments.resolveForRead(storedName);

        long length;
        try {
            length = Files.size(path);
        }
        catch (IOException ex) {
            throw ApiException.notFound("ATTACHMENT_NOT_FOUND", "Dosya bulunamadi.");
        }

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_OCTET_STREAM_VALUE)
                // Dosya adi icerikle birlikte degisir; uzun sure onbelleklenebilir.
                .cacheControl(CacheControl.maxAge(Duration.ofDays(30)).cachePublic())
                .contentLength(length)
                // attachment: tarayici dosyayi sayfada calistirmak yerine indirir.
                // Depolanan XSS'e karsi ikinci savunma hatti.
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment")
                .body(new FileSystemResource(path));
    }

    @PatchMapping("/api/messages/{messageId}")
    MessageResponse edit(@AuthenticationPrincipal AuthenticatedUser me,
            @PathVariable UUID messageId,
            @Valid @RequestBody EditMessageRequest request) {
        MessageResponse message = messageService.edit(messageId, me.id(), request.content());
        broadcast(message.channelId(), ChannelEvent.edited(message));
        return message;
    }

    @DeleteMapping("/api/messages/{messageId}")
    MessageResponse delete(@AuthenticationPrincipal AuthenticatedUser me,
            @PathVariable UUID messageId) {
        MessageResponse message = messageService.delete(messageId, me.id());
        broadcast(message.channelId(), ChannelEvent.deleted(message));
        return message;
    }

    private void broadcast(UUID channelId, ChannelEvent event) {
        broker.convertAndSend("/topic/channel." + channelId, event);
    }
}
