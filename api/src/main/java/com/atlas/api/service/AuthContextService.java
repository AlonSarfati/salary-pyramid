package com.atlas.api.service;

import com.atlas.api.service.AllowlistService.AllowlistEntry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * Service for extracting identity from JWT and matching against allowlist.
 * Used by both AuthMeController and AuthDebugController to ensure consistent logic.
 */
@Service
public class AuthContextService {
    private static final Logger log = LoggerFactory.getLogger(AuthContextService.class);
    private final AllowlistService allowlistService;

    public AuthContextService(AllowlistService allowlistService) {
        this.allowlistService = allowlistService;
    }

    public record ExtractedIdentity(
        String issuer,
        String subject,
        String email,
        String displayName
    ) {}

    public record AllowlistMatchResult(
        boolean matched,
        String matchMethod, // "issuer+sub", "email", or "none"
        Optional<AllowlistEntry> entry
    ) {}

    /**
     * Extract identity from JWT token.
     */
    public ExtractedIdentity extractIdentity(Jwt jwt) {
        String issuer = jwt.getClaimAsString("iss");
        String subject = jwt.getClaimAsString("sub");
        String email = extractEmail(jwt);
        String displayName = extractDisplayName(jwt);
        return new ExtractedIdentity(issuer, subject, email, displayName);
    }

    /**
     * Match extracted identity against allowlist.
     * Returns match result with method used and entry if found.
     */
    public AllowlistMatchResult matchAllowlist(ExtractedIdentity identity) {
        String issuer = identity.issuer();
        String subject = identity.subject();
        String email = identity.email();

        // First, try issuer+subject
        if (issuer != null && subject != null) {
            var byIssSub = allowlistService.findByIssuerAndSubject(issuer, subject);
            if (byIssSub.isPresent()) {
                return new AllowlistMatchResult(true, "issuer+sub", byIssSub);
            }
        }

        // If not found, try email
        if (email != null && !email.isEmpty()) {
            var byEmail = allowlistService.findByEmail(email);
            if (byEmail.isPresent()) {
                // If found by email, bind it to issuer+subject for future lookups
                var entry = byEmail.get();
                if (issuer != null && subject != null) {
                    allowlistService.bindIssuerSubject(entry.id(), issuer, subject);
                    // Re-fetch after binding to get updated entry
                    var boundEntry = allowlistService.findByIssuerAndSubject(issuer, subject);
                    if (boundEntry.isPresent()) {
                        return new AllowlistMatchResult(true, "email", boundEntry);
                    }
                }
                return new AllowlistMatchResult(true, "email", byEmail);
            }
        }

        return new AllowlistMatchResult(false, "none", Optional.empty());
    }

    private String extractEmail(Jwt jwt) {
        String[] emailClaims = new String[] { "email", "preferred_username", "upn", "unique_name" };
        for (String claim : emailClaims) {
            String value = jwt.getClaimAsString(claim);
            if (value != null && !value.trim().isEmpty()) {
                return value.trim().toLowerCase();
            }
        }
        return null;
    }

    private String extractDisplayName(Jwt jwt) {
        String name = jwt.getClaimAsString("name");
        if (name != null && !name.trim().isEmpty()) {
            return name.trim();
        }
        String given = jwt.getClaimAsString("given_name");
        String family = jwt.getClaimAsString("family_name");
        if (given != null || family != null) {
            return ((given != null ? given : "") + " " + (family != null ? family : "")).trim();
        }
        return null;
    }
}

