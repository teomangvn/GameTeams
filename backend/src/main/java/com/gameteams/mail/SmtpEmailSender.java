package com.gameteams.mail;

import java.nio.charset.StandardCharsets;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import com.gameteams.config.GameTeamsProperties;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;

@Service
public class SmtpEmailSender implements EmailSender {

    private static final Logger log = LoggerFactory.getLogger(SmtpEmailSender.class);

    private final JavaMailSender mailSender;
    private final TemplateEngine templateEngine;
    private final GameTeamsProperties properties;

    SmtpEmailSender(JavaMailSender mailSender, TemplateEngine templateEngine,
            GameTeamsProperties properties) {
        this.mailSender = mailSender;
        this.templateEngine = templateEngine;
        this.properties = properties;
    }

    @Override
    @Async
    public void sendVerificationEmail(String to, String displayName, String verifyUrl) {
        send(to, "GameTeams hesabını doğrula", "mail/verify-email",
                Map.of("displayName", displayName, "verifyUrl", verifyUrl));
    }

    @Override
    @Async
    public void sendPasswordResetEmail(String to, String displayName, String resetUrl) {
        send(to, "GameTeams şifreni sıfırla", "mail/reset-password",
                Map.of("displayName", displayName, "resetUrl", resetUrl));
    }

    @Override
    @Async
    public void sendEmailChangeEmail(String to, String displayName, String confirmUrl) {
        send(to, "GameTeams e-posta adresini doğrula", "mail/email-change",
                Map.of("displayName", displayName, "confirmUrl", confirmUrl));
    }

    @Override
    @Async
    public void sendLoginCodeEmail(String to, String displayName, String code, String device) {
        send(to, "GameTeams giris kodun: " + code, "mail/login-code",
                Map.of("displayName", displayName, "code", code, "device", device));
    }

    private void send(String to, String subject, String template, Map<String, Object> variables) {
        try {
            Context context = new Context();
            context.setVariables(variables);
            String html = templateEngine.process(template, context);

            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper =
                    new MimeMessageHelper(message, false, StandardCharsets.UTF_8.name());
            helper.setFrom(properties.mailFrom());
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(html, true);

            mailSender.send(message);
            log.debug("Mail gönderildi: {} -> {}", template, to);
        }
        catch (MessagingException | org.springframework.mail.MailException ex) {
            // Asenkron çalıştığı için istek akışını etkilemez. Kullanıcıya her
            // durumda aynı yanıt döner; aksi halde e-posta varlığı sızardı.
            log.error("Mail gönderilemedi ({} -> {}): {}", template, to, ex.getMessage());
        }
    }
}
