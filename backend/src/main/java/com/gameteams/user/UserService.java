package com.gameteams.user;

import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.gameteams.auth.AuthDtos.UserResponse;
import com.gameteams.common.ApiException;
import com.gameteams.user.UserDtos.UpdateProfileRequest;

/**
 * Kullanıcının kendi profili üzerindeki işlemler.
 *
 * Yanıtlar DTO olarak işlem içinde üretilir; entity döndürmek işlem dışında
 * lazy alanlara erişildiğinde patlamaya yol açar.
 */
@Service
public class UserService {

    private final UserRepository users;
    private final AvatarStorage avatars;

    UserService(UserRepository users, AvatarStorage avatars) {
        this.users = users;
        this.avatars = avatars;
    }

    @Transactional
    public UserResponse updateProfile(UUID userId, UpdateProfileRequest request) {
        User user = require(userId);

        user.setDisplayName(request.displayName().trim());
        user.setBio(blankToNull(request.bio()));
        user.setRegion(blankToNull(request.region()));
        user.setLanguage(blankToNull(request.language()));

        return UserResponse.from(user);
    }

    /**
     * Yeni avatarı kaydeder ve eskisini siler.
     *
     * Dosya işlemden önce yazılır: yazma başarısız olursa veritabanına
     * dokunulmamış olur. Eski dosya ancak yeni URL kaydedildikten sonra
     * silinir, böylece yarıda kalan bir işlem kullanıcıyı avatarsız bırakmaz.
     */
    @Transactional
    public UserResponse updateAvatar(UUID userId, MultipartFile file) {
        User user = require(userId);
        String previous = user.getAvatarUrl();

        user.setAvatarUrl(avatars.store(file));
        UserResponse response = UserResponse.from(user);

        avatars.deleteByUrl(previous);
        return response;
    }

    @Transactional
    public UserResponse removeAvatar(UUID userId) {
        User user = require(userId);
        String previous = user.getAvatarUrl();

        user.setAvatarUrl(null);
        UserResponse response = UserResponse.from(user);

        avatars.deleteByUrl(previous);
        return response;
    }

    private User require(UUID userId) {
        return users.findById(userId)
                .orElseThrow(() -> ApiException.notFound("USER_NOT_FOUND", "Hesabın bulunamadı."));
    }

    /** Boş bırakılan alanlar null saklanır; "" ile null ayrımı kullanıcı için anlamsız. */
    private static String blankToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
