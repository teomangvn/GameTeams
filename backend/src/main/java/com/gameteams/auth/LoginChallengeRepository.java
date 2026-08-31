package com.gameteams.auth;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface LoginChallengeRepository extends JpaRepository<LoginChallenge, UUID> {

    Optional<LoginChallenge> findById(UUID id);
}
