package com.gameteams.mail;

/**
 * Dev'de Mailpit, prod'da AWS SES SMTP. Fark yalnızca application-{profile}.yml
 * içindedir; çağıran kod her iki ortamda aynıdır.
 */
public interface EmailSender {

    void sendVerificationEmail(String to, String displayName, String verifyUrl);

    /** Yeni adrese gonderilen dogrulama baglantisi. */
    void sendEmailChangeEmail(String to, String displayName, String confirmUrl);

    /** Taninmayan cihazdan giris denemesi icin tek kullanimlik kod. */
    void sendLoginCodeEmail(String to, String displayName, String code, String device);

    void sendPasswordResetEmail(String to, String displayName, String resetUrl);
}
