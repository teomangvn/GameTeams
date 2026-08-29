package com.gameteams.user;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<User, UUID> {

    // Şemadaki benzersizlik lower(email)/lower(username) üzerinde tanımlı,
    // sorgular da aynı şekilde büyük/küçük harf duyarsız olmalı.
    @Query("select u from User u where lower(u.email) = lower(:email)")
    Optional<User> findByEmailIgnoreCase(@Param("email") String email);

    @Query("select u from User u where lower(u.username) = lower(:username)")
    Optional<User> findByUsernameIgnoreCase(@Param("username") String username);

    @Query("select count(u) > 0 from User u where lower(u.email) = lower(:email)")
    boolean existsByEmailIgnoreCase(@Param("email") String email);

    @Query("select count(u) > 0 from User u where lower(u.username) = lower(:username)")
    boolean existsByUsernameIgnoreCase(@Param("username") String username);

    long countByEmailVerifiedTrue();

    long countByDisabledAtIsNotNull();

    /** Admin panelindeki arama: kullanici adi, gorunen ad veya e-posta. */
    @Query("select u from User u where lower(u.username) like lower(concat('%', :q, '%')) "
            + "or lower(u.displayName) like lower(concat('%', :q, '%')) "
            + "or lower(u.email) like lower(concat('%', :q, '%'))")
    Page<User> search(@Param("q") String query, Pageable pageable);
}
