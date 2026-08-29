package com.gameteams.admin;

import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.gameteams.admin.AdminDtos.AdminRoomSummary;
import com.gameteams.admin.AdminDtos.AdminUserSummary;
import com.gameteams.admin.AdminDtos.DisableUserRequest;
import com.gameteams.admin.AdminDtos.Stats;
import com.gameteams.admin.AdminDtos.UserPage;
import com.gameteams.auth.AuthenticatedUser;

import jakarta.validation.Valid;

/**
 * Yonetim uclari. Erisim SecurityConfig'te /api/admin/** icin ROLE_ADMIN ile
 * sinirlandirilmistir.
 */
@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final AdminService adminService;

    AdminController(AdminService adminService) {
        this.adminService = adminService;
    }

    @GetMapping("/stats")
    Stats stats() {
        return adminService.stats();
    }

    @GetMapping("/users")
    UserPage users(@RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size) {
        return adminService.listUsers(q, page, size);
    }

    @PostMapping("/users/{userId}/disable")
    AdminUserSummary disable(@AuthenticationPrincipal AuthenticatedUser me,
            @PathVariable UUID userId, @Valid @RequestBody DisableUserRequest request) {
        return adminService.disableUser(userId, me.id(), request.reason());
    }

    @PostMapping("/users/{userId}/enable")
    AdminUserSummary enable(@PathVariable UUID userId) {
        return adminService.enableUser(userId);
    }

    @GetMapping("/rooms")
    List<AdminRoomSummary> rooms() {
        return adminService.listRooms();
    }

    @DeleteMapping("/rooms/{roomId}")
    ResponseEntity<Void> deleteRoom(@PathVariable UUID roomId) {
        adminService.deleteRoom(roomId);
        return ResponseEntity.noContent().build();
    }
}
