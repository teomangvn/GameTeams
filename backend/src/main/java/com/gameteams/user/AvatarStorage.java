package com.gameteams.user;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

import javax.imageio.ImageIO;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.gameteams.common.ApiException;
import com.gameteams.config.GameTeamsProperties;

/**
 * Avatar dosyalarinin diske yazilmasi ve okunmasi.
 *
 * Dosya adi ve icerigi tamamen istemciden geldigi icin hicbiri guvenilmez:
 * ad hic kullanilmaz (rastgele UUID uretilir), icerik ise gercekten
 * cozulebilen bir goruntu mu diye dogrulanir.
 */
@Service
public class AvatarStorage {

    private static final Logger log = LoggerFactory.getLogger(AvatarStorage.class);

    /** Beyaz liste: MIME turu -> dosya uzantisi. Disindaki her sey reddedilir. */
    private static final Map<String, String> ALLOWED = Map.of(
            "image/png", "png",
            "image/jpeg", "jpg",
            "image/webp", "webp",
            "image/gif", "gif");

    /** Servis edilirken dosya adinin uyacagi kalip; yol gecisi (../) imkansiz. */
    private static final Pattern SAFE_NAME = Pattern.compile("^[0-9a-f]{32}\\.(png|jpg|webp|gif)$");

    private final Path directory;
    private final long maxBytes;

    AvatarStorage(GameTeamsProperties properties) {
        this.directory = Path.of(properties.uploads().avatarDir()).toAbsolutePath().normalize();
        this.maxBytes = properties.uploads().maxAvatarBytes();
    }

    /**
     * Yuklenen dosyayi kaydeder ve public URL yolunu dondurur.
     * Kayit basarisiz olursa hicbir dosya birakmaz.
     */
    public String store(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw ApiException.badRequest("AVATAR_EMPTY", "Bir görsel seç.");
        }
        if (file.getSize() > maxBytes) {
            throw ApiException.badRequest("AVATAR_TOO_LARGE",
                    "Görsel en fazla %d MB olabilir.".formatted(maxBytes / (1024 * 1024)));
        }

        String contentType = file.getContentType() == null
                ? ""
                : file.getContentType().toLowerCase(Locale.ROOT).trim();
        String extension = ALLOWED.get(contentType);
        if (extension == null) {
            throw ApiException.badRequest("AVATAR_TYPE",
                    "Yalnızca PNG, JPEG, WebP veya GIF yükleyebilirsin.");
        }

        // Content-Type basligi istemcinin iddiasi. Dosyayi gercekten cozmeyi
        // deneyerek gorsel kilifina sokulmus baska bir icerigi eliyoruz.
        try (InputStream probe = file.getInputStream()) {
            if (ImageIO.read(probe) == null) {
                throw ApiException.badRequest("AVATAR_INVALID", "Dosya geçerli bir görsel değil.");
            }
        }
        catch (IOException ex) {
            throw ApiException.badRequest("AVATAR_INVALID", "Görsel okunamadı.");
        }

        String name = UUID.randomUUID().toString().replace("-", "") + "." + extension;
        Path target = directory.resolve(name);

        try {
            Files.createDirectories(directory);
            try (InputStream in = file.getInputStream()) {
                Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
            }
        }
        catch (IOException ex) {
            throw new IllegalStateException("Avatar diske yazılamadı: " + target, ex);
        }

        return publicUrl(name);
    }

    /**
     * Onceki avatari siler. Basarisizlik sessizce yutulur: profil guncellemesi
     * artik dosyanin silinmesine bagli degil, yetim dosya kabul edilebilir.
     */
    public void deleteByUrl(String url) {
        String name = fileNameFromUrl(url);
        if (name == null) {
            return;
        }
        try {
            Files.deleteIfExists(directory.resolve(name));
        }
        catch (IOException ex) {
            log.warn("Eski avatar silinemedi: {}", name, ex);
        }
    }

    /** Servis edilecek dosyanin diskteki yolu. Ad kalibi tutmuyorsa 404. */
    public Path resolveForRead(String fileName) {
        if (fileName == null || !SAFE_NAME.matcher(fileName).matches()) {
            throw ApiException.notFound("AVATAR_NOT_FOUND", "Görsel bulunamadı.");
        }
        Path path = directory.resolve(fileName).normalize();
        // Kalip zaten yeterli, ama dizin disina cikilmadigini ayrica dogrula.
        if (!path.startsWith(directory) || !Files.isReadable(path)) {
            throw ApiException.notFound("AVATAR_NOT_FOUND", "Görsel bulunamadı.");
        }
        return path;
    }

    public String contentTypeOf(String fileName) {
        int dot = fileName.lastIndexOf('.');
        String extension = dot < 0 ? "" : fileName.substring(dot + 1);
        return switch (extension) {
            case "png" -> "image/png";
            case "jpg" -> "image/jpeg";
            case "webp" -> "image/webp";
            case "gif" -> "image/gif";
            default -> "application/octet-stream";
        };
    }

    private static String publicUrl(String fileName) {
        return "/api/users/avatars/" + fileName;
    }

    /** Yalnizca bu servisin urettigi URL'lerden dosya adi cikarir. */
    private static String fileNameFromUrl(String url) {
        String prefix = "/api/users/avatars/";
        if (url == null || !url.startsWith(prefix)) {
            return null;
        }
        String name = url.substring(prefix.length());
        return SAFE_NAME.matcher(name).matches() ? name : null;
    }
}
