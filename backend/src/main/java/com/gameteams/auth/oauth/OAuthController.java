package com.gameteams.auth.oauth;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth/oauth2")
public class OAuthController {

    private final OAuthClients clients;

    OAuthController(OAuthClients clients) {
        this.clients = clients;
    }

    /** Giris ekraninda hangi saglayici butonlarinin gosterilecegi. */
    @GetMapping("/providers")
    ProvidersResponse providers() {
        return new ProvidersResponse(clients.providerIds());
    }

    record ProvidersResponse(List<String> providers) {
    }
}
