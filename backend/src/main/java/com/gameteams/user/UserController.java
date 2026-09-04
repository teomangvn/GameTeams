package com.gameteams.user;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.gameteams.auth.AuthDtos.UserResponse;
import com.gameteams.auth.AuthenticatedUser;
import com.gameteams.common.ApiException;
import com.gameteams.auth.AuthDtos.MessageResponse;
import com.gameteams.user.UserDtos.ChangeEmailRequest;
import com.gameteams.user.UserDtos.ConfirmEmailChangeRequest;
import com.gameteams.user.UserDtos.UpdateProfileRequest;

import jakarta.validation.Valid;

import java.time.Duration;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;
    private final AvatarStorage avatars;

    UserController(UserService userService, AvatarStorage avatars) {
        this.userService = userService;
        this.avatars = avatars;
    }

    @PatchMapping("/me")
    ResponseEntity<UserResponse> updateProfile(
            @AuthenticationPrincipal AuthenticatedUser principal,
            @Valid @RequestBody UpdateProfileRequest request) {

        return ResponseEntity.ok(userService.updateProfile(require(principal).id(), request));
    }

    @PostMapping("/me/avatar")
    ResponseEntity<UserResponse> uploadAvatar(
            @AuthenticationPrincipal AuthenticatedUser principal,
            @RequestParam("file") MultipartFile file) {

        return ResponseEntity.ok(userService.updateAvatar(require(principal).id(), file));
    }

    /** E-posta değişikliği başlatır; yeni adrese doğrulama bağlantısı gider. */
    @PostMapping("/me/email")
    ResponseEntity<MessageResponse> requestEmailChange(
            @AuthenticationPrincipal AuthenticatedUser principal,
            @Valid @RequestBody ChangeEmailRequest request) {

        userService.requestEmailChange(require(principal).id(), request.newEmail(),
                request.password());
        return ResponseEntity.ok(new MessageResponse(
                "Doğrulama bağlantısı yeni adresine gönderildi. Tıklayana kadar adresin değişmez."));
    }

    /**
     * Bağlantıdaki token'ı doğrular ve adresi uygular.
     *
     * Kimlik gerektirmez: kullanıcı bağlantıya e-posta istemcisinden, çoğu
     * zaman oturumu açık olmayan bir tarayıcıda tıklar. Token'ın kendisi
     * kanıttır ve tek kullanımlıktır.
     */
    @PostMapping("/email-change/confirm")
    ResponseEntity<MessageResponse> confirmEmailChange(
            @Valid @RequestBody ConfirmEmailChangeRequest request) {

        userService.confirmEmailChange(request.token());
        return ResponseEntity.ok(new MessageResponse("E-posta adresin güncellendi."));
    }

    @DeleteMapping("/me/avatar")
    ResponseEntity<UserResponse> removeAvatar(@AuthenticationPrincipal AuthenticatedUser principal) {
        return ResponseEntity.ok(userService.removeAvatar(require(principal).id()));
    }

    /**
     * Avatar görselini servis eder.
     *
     * Bu uç bilerek herkese açık: tarayıcı <img> etiketiyle istek atarken
     * Authorization başlığı göndermez. Dosya adları rastgele UUID olduğu için
     * sıralanabilir değil ve avatarlar zaten gizli veri taşımaz.
     */
    @GetMapping("/avatars/{fileName}")
    ResponseEntity<Resource> avatar(@PathVariable String fileName) {
        Path path = avatars.resolveForRead(fileName);

        long length;
        try {
            length = Files.size(path);
        }
        catch (IOException ex) {
            throw ApiException.notFound("AVATAR_NOT_FOUND", "Görsel bulunamadı.");
        }

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, avatars.contentTypeOf(fileName))
                // Dosya adı içerikle birlikte değişir (yeni yükleme = yeni ad),
                // bu yüzden uzun süre önbelleklenebilir.
                .cacheControl(CacheControl.maxAge(Duration.ofDays(30)).cachePublic())
                .contentLength(length)
                // Tarayıcı görseli sayfada göstersin, indirme diyaloğu açmasın.
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline")
                .body(new FileSystemResource(path));
    }

    private static AuthenticatedUser require(AuthenticatedUser principal) {
        if (principal == null) {
            throw ApiException.unauthorized("UNAUTHENTICATED", "Giriş yapman gerekiyor.");
        }
        return principal;
    }
}
