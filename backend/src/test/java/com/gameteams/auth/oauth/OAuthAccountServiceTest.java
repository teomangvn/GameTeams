package com.gameteams.auth.oauth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

import com.gameteams.auth.RefreshTokenRepository;
import com.gameteams.user.User;
import com.gameteams.user.UserRepository;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class OAuthAccountServiceTest {

    @Mock
    private UserRepository users;

    @Mock
    private UserIdentityRepository identities;

    @Mock
    private RefreshTokenRepository refreshTokens;

    @InjectMocks
    private OAuthAccountService service;

    private static User user(String username, String email, boolean verified) {
        User user = new User(username, username, email, "$2a$12$hash");
        user.setEmailVerified(verified);
        ReflectionTestUtils.setField(user, "id", UUID.randomUUID());
        return user;
    }

    private static OAuthProfile google(String email, boolean verified) {
        return new OAuthProfile(OAuthProfile.GOOGLE, "google-sub-1", email, verified, "Ayşe Yılmaz");
    }

    @Test
    void daha_once_baglanmis_kimlik_ayni_kullaniciya_girer() {
        User existing = user("ayse", "ayse@example.com", true);
        when(identities.findByProviderAndSubject("google", "google-sub-1"))
                .thenReturn(Optional.of(new UserIdentity(existing, "google", "google-sub-1", null)));

        User resolved = service.resolve(google("yeni-adres@example.com", true));

        assertThat(resolved).isSameAs(existing);
        verify(users, never()).save(any());
    }

    @Test
    void devre_disi_hesaba_harici_girisle_de_girilemez() {
        User disabled = user("ayse", "ayse@example.com", true);
        disabled.disable("spam");
        when(identities.findByProviderAndSubject(anyString(), anyString()))
                .thenReturn(Optional.of(new UserIdentity(disabled, "google", "google-sub-1", null)));

        assertThatThrownBy(() -> service.resolve(google("ayse@example.com", true)))
                .isInstanceOf(OAuthLoginException.class)
                .extracting("code").isEqualTo("ACCOUNT_DISABLED");
    }

    @Test
    void dogrulanmis_eposta_mevcut_hesaba_baglanir_sifre_korunur() {
        User existing = user("ayse", "ayse@example.com", true);
        when(identities.findByProviderAndSubject(anyString(), anyString())).thenReturn(Optional.empty());
        when(users.findByEmailIgnoreCase("ayse@example.com")).thenReturn(Optional.of(existing));

        User resolved = service.resolve(google("ayse@example.com", true));

        assertThat(resolved).isSameAs(existing);
        assertThat(existing.hasPassword()).isTrue();
        verify(identities).save(any(UserIdentity.class));
        verify(refreshTokens, never()).revokeAllForUser(any(), any());
    }

    /**
     * On-ele gecirme: saldirgan kurbanin adresiyle kayit olup sifre koyar ama
     * adresi dogrulayamaz. Kurban Google ile girince saldirganin sifresi
     * gecerli bir girise donusmemeli.
     */
    @Test
    void dogrulanmamis_hesaba_baglaninca_sifre_silinir_oturumlar_kapanir() {
        User squatted = user("saldirgan", "kurban@example.com", false);
        when(identities.findByProviderAndSubject(anyString(), anyString())).thenReturn(Optional.empty());
        when(users.findByEmailIgnoreCase("kurban@example.com")).thenReturn(Optional.of(squatted));

        service.resolve(google("kurban@example.com", true));

        assertThat(squatted.hasPassword()).isFalse();
        assertThat(squatted.isEmailVerified()).isTrue();
        verify(refreshTokens).revokeAllForUser(eq(squatted), any());
    }

    @Test
    void dogrulanmamis_saglayici_epostasi_mevcut_hesabi_ele_geciremez() {
        User existing = user("ayse", "ayse@example.com", true);
        when(identities.findByProviderAndSubject(anyString(), anyString())).thenReturn(Optional.empty());
        when(users.findByEmailIgnoreCase("ayse@example.com")).thenReturn(Optional.of(existing));

        var facebook = new OAuthProfile(OAuthProfile.FACEBOOK, "fb-1", "ayse@example.com", false, "Ayşe");

        assertThatThrownBy(() -> service.resolve(facebook))
                .isInstanceOf(OAuthLoginException.class)
                .extracting("code").isEqualTo("ACCOUNT_EXISTS");
        verify(identities, never()).save(any());
    }

    @Test
    void eposta_yoksa_hesap_acilmaz() {
        when(identities.findByProviderAndSubject(anyString(), anyString())).thenReturn(Optional.empty());

        var noEmail = new OAuthProfile(OAuthProfile.FACEBOOK, "fb-1", null, false, "Ayşe");

        assertThatThrownBy(() -> service.resolve(noEmail))
                .isInstanceOf(OAuthLoginException.class)
                .extracting("code").isEqualTo("EMAIL_REQUIRED");
    }

    @Test
    void yeni_kullanici_sifresiz_ve_dogrulanmis_acilir() {
        when(identities.findByProviderAndSubject(anyString(), anyString())).thenReturn(Optional.empty());
        when(users.findByEmailIgnoreCase(anyString())).thenReturn(Optional.empty());
        when(users.existsByUsernameIgnoreCase(anyString())).thenReturn(false);

        User created = service.resolve(google("Ayse.Yilmaz@example.com", true));

        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        verify(users).save(saved.capture());
        assertThat(saved.getValue()).isSameAs(created);
        assertThat(created.hasPassword()).isFalse();
        assertThat(created.isEmailVerified()).isTrue();
        assertThat(created.getUsername()).isEqualTo("ayse.yilmaz");
        assertThat(created.getDisplayName()).isEqualTo("Ayşe Yılmaz");
    }

    @Test
    void alinmis_kullanici_adina_sonek_eklenir() {
        when(identities.findByProviderAndSubject(anyString(), anyString())).thenReturn(Optional.empty());
        when(users.findByEmailIgnoreCase(anyString())).thenReturn(Optional.empty());
        when(users.existsByUsernameIgnoreCase("ayse")).thenReturn(true);

        User created = service.resolve(google("ayse@example.com", true));

        assertThat(created.getUsername()).matches("ayse_\\d{4}");
    }

    @Test
    void kullanici_adi_kayit_kuralina_uyar() {
        assertThat(OAuthAccountService.usernameBase(
                new OAuthProfile("google", "s", "Çağrı Öztürk+oyun@example.com", true, null)))
                .isEqualTo("cagri_ozturkoyun");
        assertThat(OAuthAccountService.usernameBase(
                new OAuthProfile("google", "s", "ab@example.com", true, null)))
                .isEqualTo("oyuncu");
        assertThat(OAuthAccountService.usernameBase(
                new OAuthProfile("google", "s", "a".repeat(40) + "@example.com", true, null)))
                .hasSize(24);
    }
}
