package com.gameteams.message;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.gameteams.common.ApiException;
import com.gameteams.config.GameTeamsProperties;

/**
 * Mesaj eklerinin diske yazılması ve okunması.
 *
 * Dosya adı ve içeriği istemciden gelir, ikisi de güvenilmez: ad yalnızca
 * gösterim için saklanır (diskte rastgele bir ad kullanılır) ve tür beyaz
 * listeyle sınırlanır.
 */
@Service
public class AttachmentStorage {

    private static final Logger log = LoggerFactory.getLogger(AttachmentStorage.class);

    /**
     * İzin verilen türler. Yürütülebilir ve betik türleri bilerek dışarıda:
     * dosyalar tarayıcıda açılabildiği için HTML/SVG saklamak depolanan XSS
     * anlamına gelirdi.
     */
    private static final Map<String, String> ALLOWED = Map.ofEntries(
            Map.entry("image/png", "png"),
            Map.entry("image/jpeg", "jpg"),
            Map.entry("image/webp", "webp"),
            Map.entry("image/gif", "gif"),
            Map.entry("application/pdf", "pdf"),
            Map.entry("text/plain", "txt"),
            Map.entry("application/zip", "zip"),
            Map.entry("audio/mpeg", "mp3"),
            Map.entry("audio/ogg", "ogg"),
            Map.entry("video/mp4", "mp4"),
            Map.entry("video/webm", "webm"));

    private static final Pattern SAFE_NAME =
            Pattern.compile("^[0-9a-f]{32}\\.[a-z0-9]{2,5}$");

    private final Path directory;
    private final long maxBytes;

    AttachmentStorage(GameTeamsProperties properties) {
        this.directory = Path.of(properties.uploads().attachmentDir()).toAbsolutePath().normalize();
        this.maxBytes = properties.uploads().maxAttachmentBytes();
    }

    /** Dosyayı kaydeder ve diskteki adını döndürür. */
    public Stored store(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw ApiException.badRequest("ATTACHMENT_EMPTY", "Bir dosya seç.");
        }
        if (file.getSize() > maxBytes) {
            throw ApiException.badRequest("ATTACHMENT_TOO_LARGE",
                    "Dosya en fazla %d MB olabilir.".formatted(maxBytes / (1024 * 1024)));
        }

        String contentType = file.getContentType() == null
                ? ""
                : file.getContentType().toLowerCase(Locale.ROOT).trim();
        String extension = ALLOWED.get(contentType);
        if (extension == null) {
            throw ApiException.badRequest("ATTACHMENT_TYPE",
                    "Bu dosya türü desteklenmiyor.");
        }

        String storedName = UUID.randomUUID().toString().replace("-", "") + "." + extension;
        Path target = directory.resolve(storedName);

        try {
            Files.createDirectories(directory);
            try (InputStream in = file.getInputStream()) {
                Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
            }
        }
        catch (IOException ex) {
            throw new IllegalStateException("Ek diske yazılamadı: " + target, ex);
        }

        return new Stored(displayName(file.getOriginalFilename(), extension), storedName,
                contentType, file.getSize());
    }

    /** Servis edilecek dosyanın diskteki yolu. Ad kalıbı tutmuyorsa 404. */
    public Path resolveForRead(String storedName) {
        if (storedName == null || !SAFE_NAME.matcher(storedName).matches()) {
            throw ApiException.notFound("ATTACHMENT_NOT_FOUND", "Dosya bulunamadı.");
        }
        Path path = directory.resolve(storedName).normalize();
        if (!path.startsWith(directory) || !Files.isReadable(path)) {
            throw ApiException.notFound("ATTACHMENT_NOT_FOUND", "Dosya bulunamadı.");
        }
        return path;
    }

    public void delete(String storedName) {
        try {
            Files.deleteIfExists(directory.resolve(storedName));
        }
        catch (IOException ex) {
            log.warn("Ek silinemedi: {}", storedName, ex);
        }
    }

    /**
     * Gösterilecek ad. İstemcinin verdiği ad yol ayracı veya kontrol karakteri
     * içerebilir; yalnızca son parçası alınır ve zararsız karakterlere indirgenir.
     */
    private static String displayName(String original, String extension) {
        if (original == null || original.isBlank()) {
            return "dosya." + extension;
        }
        String base = original.replace('\\', '/');
        base = base.substring(base.lastIndexOf('/') + 1);
        base = base.replaceAll("[\\p{Cntrl}]", "").trim();
        if (base.isEmpty()) {
            return "dosya." + extension;
        }
        return base.length() <= 255 ? base : base.substring(0, 255);
    }

    /** store() sonucu: veritabanına yazılacak üstveri. */
    public record Stored(String fileName, String storedName, String contentType, long sizeBytes) {
    }
}
