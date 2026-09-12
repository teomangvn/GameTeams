package com.gameteams.auth.oauth;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserIdentityRepository extends JpaRepository<UserIdentity, UUID> {

    @Query("select i from UserIdentity i join fetch i.user "
            + "where i.provider = :provider and i.subject = :subject")
    Optional<UserIdentity> findByProviderAndSubject(@Param("provider") String provider,
            @Param("subject") String subject);
}
