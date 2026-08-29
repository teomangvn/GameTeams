package com.gameteams.user;

public enum Role {
    USER,
    ADMIN;

    /** Spring Security "ROLE_" öneki bekler. */
    public String authority() {
        return "ROLE_" + name();
    }
}
