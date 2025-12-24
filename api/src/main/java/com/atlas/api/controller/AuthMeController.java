package com.atlas.api.controller;

import com.atlas.api.service.AuthContextService;
import com.atlas.api.service.AllowlistService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/auth")
public class AuthMeController {
    private static final Logger log = LoggerFactory.getLogger(AuthMeController.class);
    private final AuthContextService authContextService;
    private final AllowlistService allowlistService;

    public AuthMeController(AuthContextService authContextService, AllowlistService allowlistService) {
        this.authContextService = authContextService;
        this.allowlistService = allowlistService;
    }

    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> getMe() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (!(authentication instanceof JwtAuthenticationToken jwtAuth)) {
            // No valid JWT - treat as unauthenticated
            return ResponseEntity.status(401).body(Map.of(
                "error", "NOT_AUTHENTICATED",
                "message", "JWT authentication required"
            ));
        }

        Jwt jwt = jwtAuth.getToken();
        
        // Extract identity from JWT (same logic as debug-claims)
        var identity = authContextService.extractIdentity(jwt);
        
        // Match against allowlist (same logic as debug-claims)
        var matchResult = authContextService.matchAllowlist(identity);
        
        // Dev-only debug log
        if (log.isDebugEnabled()) {
            log.debug("AuthMeController: extractedEmail={}, iss={}, sub={}, allowlistMatch={}, matchMethod={}",
                    identity.email(), identity.issuer(), identity.subject(), 
                    matchResult.matched(), matchResult.matchMethod());
        }

        // If no match found
        if (!matchResult.matched()) {
            return ResponseEntity.status(403).body(Map.of(
                "error", "ACCESS_DENIED",
                "message", "Your account is not approved yet."
            ));
        }

        var entry = matchResult.entry().get();

        // Check if account is disabled
        if (!"ACTIVE".equals(entry.status())) {
            return ResponseEntity.status(403).body(Map.of(
                "error", "ACCOUNT_DISABLED",
                "message", "Your account has been disabled."
            ));
        }

        // User is allowlisted and active - return user info
        Map<String, Object> response = new HashMap<>();
        
        // User identity
        Map<String, Object> userIdentity = new HashMap<>();
        userIdentity.put("issuer", identity.issuer());
        userIdentity.put("subject", identity.subject());
        userIdentity.put("email", identity.email());
        userIdentity.put("displayName", identity.displayName());
        response.put("userIdentity", userIdentity);
        
        // Authorization info from allowlist entry
        response.put("role", entry.role());
        response.put("mode", entry.mode());
        response.put("allowedTenantIds", entry.tenantIds() != null ? entry.tenantIds() : List.of());
        
        // Set primary tenant for SINGLE_TENANT mode
        if ("SINGLE_TENANT".equals(entry.mode()) && 
            entry.tenantIds() != null && 
            !entry.tenantIds().isEmpty()) {
            response.put("primaryTenantId", entry.tenantIds().get(0));
        }
        
        return ResponseEntity.ok(response);
    }
}

