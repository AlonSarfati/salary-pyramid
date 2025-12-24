package com.atlas.api.auth;

import com.atlas.api.service.AllowlistService;
import com.atlas.api.service.AuthContextService;
import com.atlas.api.service.UserIdentityService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Filter that enforces the closed-by-default access model.
 * Runs after JWT authentication and checks the allowlist.
 */
@Component
public class AccessGateFilter extends OncePerRequestFilter {
    private static final Logger log = LoggerFactory.getLogger(AccessGateFilter.class);
    private final AuthContextService authContextService;
    private final AllowlistService allowlistService;
    private final UserIdentityService userIdentityService;
    private final UserContext userContext;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public AccessGateFilter(
        AuthContextService authContextService,
        AllowlistService allowlistService,
        UserIdentityService userIdentityService,
        UserContext userContext
    ) {
        this.authContextService = authContextService;
        this.allowlistService = allowlistService;
        this.userIdentityService = userIdentityService;
        this.userContext = userContext;
    }

    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain filterChain
    ) throws ServletException, IOException {
        
        String path = request.getRequestURI();
        String contextPath = request.getContextPath();
        String servletPath = request.getServletPath();

        // Skip allowlist check for public endpoints, actuator, and admin endpoints
        // But still populate UserContext for admin endpoints so controllers can check permissions
        // Note: With context-path=/api, requestURI may be /api/... or just /... depending on servlet container
        boolean isPublicPath = path.startsWith("/api/public/") || path.startsWith("/public/");
        boolean isActuatorPath = path.startsWith("/api/actuator/") || path.startsWith("/actuator/");
        boolean isAdminPath = path.startsWith("/api/admin/") || path.startsWith("/admin/");
        boolean isDebugPath = path.equals("/api/auth/debug-claims") || path.equals("/auth/debug-claims");
        
        if (isPublicPath || isActuatorPath) {
            // Skip completely for public/actuator
            filterChain.doFilter(request, response);
            return;
        }
        
        // For admin and debug paths, populate UserContext but don't block
        if (isAdminPath || isDebugPath) {
            // Check if there's a Bearer token - if so, authentication might not be complete yet
            String authHeader = request.getHeader("Authorization");
            boolean hasBearerToken = authHeader != null && authHeader.startsWith("Bearer ");
            
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication instanceof JwtAuthenticationToken jwtAuth) {
                // JWT is already authenticated - populate context
                populateContext(jwtAuth, null);
            }
            filterChain.doFilter(request, response);
            return;
        }

        // Only process API requests
        // With context-path=/api, requestURI includes the context path (e.g., /api/tenants)
        // Without context path, requestURI is the full path (e.g., /api/tenants)
        // So we check for /api/ prefix OR if contextPath is /api, then any path starting with / is an API path
        boolean isApiPath = path.startsWith("/api/") || 
                           (contextPath.equals("/api") && path.startsWith("/"));
        if (!isApiPath) {
            filterChain.doFilter(request, response);
            return;
        }

        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        // For /api/auth/me or /auth/me: require JWT at SecurityConfig level but don't block here;
        // we still try to populate context so controller can know allowlist status.
        if (path.equals("/api/auth/me") || path.equals("/auth/me")) {
            if (authentication instanceof JwtAuthenticationToken jwtAuth) {
                populateContext(jwtAuth, null);
            }
            filterChain.doFilter(request, response);
            return;
        }

        // Check if we have a JWT token
        // If authentication is not a JwtAuthenticationToken, it might mean:
        // 1. The OAuth2 resource server filter hasn't processed the JWT yet (filter order issue)
        // 2. The request doesn't have a valid JWT token
        // 3. The JWT token is invalid/expired
        if (!(authentication instanceof JwtAuthenticationToken jwtAuth)) {
            // Check if there's an Authorization header - if so, the OAuth2 filter should process it
            String authHeader = request.getHeader("Authorization");
            boolean hasBearerToken = authHeader != null && authHeader.startsWith("Bearer ");
            
            if (hasBearerToken && (authentication == null || !authentication.isAuthenticated())) {
                // We have a Bearer token but authentication hasn't been processed yet
                // This suggests a filter order issue - the OAuth2 filter hasn't run yet
                // In this case, let the request continue and let Spring Security handle it
                // The OAuth2 filter will process the token, and if it's invalid, Spring Security will return 401
                filterChain.doFilter(request, response);
                return;
            } else {
                // No Bearer token or authentication failed - deny access
                sendAccessDenied(response, "ACCESS_DENIED", "Authentication required");
                return;
            }
        }

        // Check allowlist and populate context
        if (!populateContext(jwtAuth, response)) {
            return; // Error already sent
        }

        // Continue with the request
        filterChain.doFilter(request, response);
    }

    /**
     * Populates user context from JWT authentication.
     * Uses the same allowlist matching logic as AuthMeController for consistency.
     * @param jwtAuth JWT authentication token
     * @param response HTTP response (null if errors should not be sent, e.g., for /api/auth/me)
     * @return true if context was populated, false if access denied
     */
    private boolean populateContext(JwtAuthenticationToken jwtAuth, HttpServletResponse response) {
        // Use shared service for identity extraction and allowlist matching (same as AuthMeController)
        var identity = authContextService.extractIdentity(jwtAuth.getToken());
        var matchResult = authContextService.matchAllowlist(identity);


        if (identity.issuer() == null || identity.subject() == null) {
            if (response != null) {
                try {
                    sendAccessDenied(response, "ACCESS_DENIED", "Invalid token: missing issuer or subject");
                } catch (IOException e) {
                    // Should not happen
                }
            }
            return false;
        }

        // If no match found
        if (!matchResult.matched()) {
            if (response != null) {
                try {
                    sendAccessDenied(response, "ACCESS_DENIED", "Your account is not approved yet.");
                } catch (IOException e) {
                    // Should not happen
                }
            }
            return false;
        }

        var entry = matchResult.entry().get();

        // Check if account is disabled
        if (!"ACTIVE".equals(entry.status())) {
            if (response != null) {
                try {
                    sendAccessDenied(response, "ACCOUNT_DISABLED", "Your account is disabled.");
                } catch (IOException e) {
                    // Should not happen
                }
            }
            return false;
        }

        // Create/update user identity
        userIdentityService.createOrUpdate(identity.issuer(), identity.subject(), identity.email(), identity.displayName());
        userIdentityService.updateLastLogin(identity.issuer(), identity.subject());

        // Populate user context
        userContext.setIssuer(identity.issuer());
        userContext.setSubject(identity.subject());
        userContext.setEmail(identity.email());
        userContext.setDisplayName(identity.displayName());
        userContext.setRole(entry.role());
        userContext.setMode(entry.mode());
        userContext.setAllowedTenantIds(entry.tenantIds() != null ? entry.tenantIds() : List.of());
        
        // Set primary tenant for SINGLE_TENANT mode
        if ("SINGLE_TENANT".equals(entry.mode()) && 
            entry.tenantIds() != null && 
            !entry.tenantIds().isEmpty()) {
            userContext.setPrimaryTenantId(entry.tenantIds().get(0));
        }
        
        return true;
    }

    private void sendAccessDenied(HttpServletResponse response, String errorCode, String message) throws IOException {
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType("application/json");
        
        Map<String, String> error = new HashMap<>();
        error.put("error", errorCode);
        error.put("message", message);
        
        objectMapper.writeValue(response.getWriter(), error);
    }
}

