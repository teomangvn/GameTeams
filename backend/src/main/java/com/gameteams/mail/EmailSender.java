package com.gameteams.mail;

/**
 * Dev'de Mailpit, prod'da AWS SES SMTP. Fark yalnızca application-{profile}.yml
 * içindedir; çağıran kod her iki ortamda aynıdır.
 */
public interface EmailSender {

    void sendVerificationEmail(String to, String displayName, String verifyUrl);

    void sendPasswordResetEmail(String to, String displayName, String resetUrl);
}
