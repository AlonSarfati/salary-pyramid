package com.atlas.api.controller;

import com.atlas.api.service.AuthContextService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

/**
 * Temporary debug controller for inspecting JWT claims and allowlist status.
 * NOTE: This endpoint should be removed or locked down in production.
 */
@RestController
@RequestMapping("/auth")
public class AuthDebugController {

    private final AuthContextService authContextService;

    public AuthDebugController(AuthContextService authContextService) {
        this.authContextService = authContextService;
    }

    @GetMapping("/debug-claims")
    public ResponseEntity<Map<String, Object>> debugClaims(HttpServletRequest request) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (!(authentication instanceof JwtAuthenticationToken jwtAuth)) {
            return ResponseEntity.status(401).body(Map.of(
                "error", "NOT_AUTHENTICATED",
                "message", "No JWT authentication present"
            ));
        }

        Jwt jwt = jwtAuth.getToken();
        
        // Use shared service for identity extraction and allowlist matching
        var identity = authContextService.extractIdentity(jwt);
        var matchResult = authContextService.matchAllowlist(identity);
        
        Object aud = jwt.getClaims().get("aud");
        String allowlistStatus = matchResult.entry()
            .map(e -> e.status())
            .orElse(null);

        Map<String, Object> body = new HashMap<>();
        body.put("iss", identity.issuer());
        body.put("sub", identity.subject());
        body.put("extractedEmail", identity.email());
        body.put("extractedName", identity.displayName());
        body.put("aud", aud);
        body.put("authClass", authentication.getClass().getName());
        body.put("requestPath", request.getRequestURI());
        body.put("allowlistMatch", matchResult.matched());
        body.put("allowlistMatchMethod", matchResult.matchMethod());
        body.put("allowlistStatus", allowlistStatus);

        return ResponseEntity.ok(body);
    }
}


