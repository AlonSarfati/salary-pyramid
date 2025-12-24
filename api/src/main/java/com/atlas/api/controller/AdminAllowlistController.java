package com.atlas.api.controller;

import com.atlas.api.auth.UserContext;
import com.atlas.api.service.AllowlistService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/admin/allowlist")
public class AdminAllowlistController {
    private final AllowlistService allowlistService;
    private final String adminKey;
    private final UserContext userContext;

    public AdminAllowlistController(
        AllowlistService allowlistService,
        @Value("${lira.admin.key:}") String adminKey,
        UserContext userContext
    ) {
        this.allowlistService = allowlistService;
        this.adminKey = adminKey;
        this.userContext = userContext;
    }
    
    /**
     * Check if current user is SYSTEM_ADMIN (for OIDC-authenticated requests)
     */
    private boolean isSystemAdmin() {
        if (!userContext.isAuthenticated()) {
            return false;
        }
        String role = userContext.getRole();
        return "SYSTEM_ADMIN".equals(role) || "ADMIN".equals(role);
    }
    
    /**
     * Check authorization (either admin key OR SYSTEM_ADMIN via OIDC)
     */
    private boolean isAuthorized(String providedKey) {
        return isValidAdminKey(providedKey) || isSystemAdmin();
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> createAllowlistEntry(
        @RequestHeader(value = "X-LIRA-ADMIN-KEY", required = false) String providedKey,
        @RequestBody CreateAllowlistRequest request
    ) {
        if (!isAuthorized(providedKey)) {
            return ResponseEntity.status(403).body(Map.of(
                "error", "FORBIDDEN",
                "message", "System administrator access required"
            ));
        }

        try {
            var entry = allowlistService.create(
                request.email(),
                request.mode(),
                request.role(),
                "admin", // created_by
                request.notes(),
                request.tenantIds()
            );

            return ResponseEntity.ok(Map.of(
                "id", entry.id().toString(),
                "email", entry.email() != null ? entry.email() : "",
                "status", entry.status(),
                "mode", entry.mode(),
                "role", entry.role(),
                "tenantIds", entry.tenantIds()
            ));
        } catch (Exception e) {
            return ResponseEntity.status(400).body(Map.of(
                "error", "BAD_REQUEST",
                "message", e.getMessage()
            ));
        }
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> listAllowlistEntries(
        @RequestHeader(value = "X-LIRA-ADMIN-KEY", required = false) String providedKey
    ) {
        if (!isAuthorized(providedKey)) {
            return ResponseEntity.status(403).body(List.of());
        }

        var entries = allowlistService.listAll();
        var response = entries.stream()
            .map(entry -> Map.<String, Object>of(
                "id", entry.id().toString(),
                "email", entry.email() != null ? entry.email() : "",
                "issuer", entry.issuer() != null ? entry.issuer() : "",
                "subject", entry.subject() != null ? entry.subject() : "",
                "status", entry.status(),
                "mode", entry.mode(),
                "role", entry.role(),
                "tenantIds", entry.tenantIds(),
                "createdAt", entry.createdAt().toString(),
                "notes", entry.notes() != null ? entry.notes() : ""
            ))
            .toList();

        return ResponseEntity.ok(response);
    }

    @PostMapping("/{id}/disable")
    public ResponseEntity<Map<String, Object>> disableEntry(
        @RequestHeader(value = "X-LIRA-ADMIN-KEY", required = false) String providedKey,
        @PathVariable String id
    ) {
        if (!isAuthorized(providedKey)) {
            return ResponseEntity.status(403).body(Map.of(
                "error", "FORBIDDEN",
                "message", "System administrator access required"
            ));
        }

        try {
            UUID uuid = UUID.fromString(id);
            allowlistService.updateStatus(uuid, "DISABLED");
            return ResponseEntity.ok(Map.of("status", "DISABLED", "id", id));
        } catch (Exception e) {
            return ResponseEntity.status(400).body(Map.of(
                "error", "BAD_REQUEST",
                "message", e.getMessage()
            ));
        }
    }

    @PostMapping("/{id}/enable")
    public ResponseEntity<Map<String, Object>> enableEntry(
        @RequestHeader(value = "X-LIRA-ADMIN-KEY", required = false) String providedKey,
        @PathVariable String id
    ) {
        if (!isAuthorized(providedKey)) {
            return ResponseEntity.status(403).body(Map.of(
                "error", "FORBIDDEN",
                "message", "System administrator access required"
            ));
        }

        try {
            UUID uuid = UUID.fromString(id);
            allowlistService.updateStatus(uuid, "ACTIVE");
            return ResponseEntity.ok(Map.of("status", "ACTIVE", "id", id));
        } catch (Exception e) {
            return ResponseEntity.status(400).body(Map.of(
                "error", "BAD_REQUEST",
                "message", e.getMessage()
            ));
        }
    }

    @PostMapping("/{id}/tenants")
    public ResponseEntity<Map<String, Object>> replaceTenants(
        @RequestHeader(value = "X-LIRA-ADMIN-KEY", required = false) String providedKey,
        @PathVariable String id,
        @RequestBody ReplaceTenantsRequest request
    ) {
        if (!isAuthorized(providedKey)) {
            return ResponseEntity.status(403).body(Map.of(
                "error", "FORBIDDEN",
                "message", "System administrator access required"
            ));
        }

        try {
            UUID uuid = UUID.fromString(id);
            allowlistService.replaceTenants(uuid, request.tenantIds());
            return ResponseEntity.ok(Map.of("id", id, "tenantIds", request.tenantIds()));
        } catch (Exception e) {
            return ResponseEntity.status(400).body(Map.of(
                "error", "BAD_REQUEST",
                "message", e.getMessage()
            ));
        }
    }

    private boolean isValidAdminKey(String providedKey) {
        return adminKey != null && !adminKey.isEmpty() && adminKey.equals(providedKey);
    }

    public record CreateAllowlistRequest(
        String email,
        String mode,
        String role,
        String notes,
        List<String> tenantIds
    ) {}

    public record ReplaceTenantsRequest(
        List<String> tenantIds
    ) {}
}

