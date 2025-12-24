package com.atlas.api.service;

import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class UserIdentityService {
    private final NamedParameterJdbcTemplate jdbc;

    public UserIdentityService(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record UserIdentity(
        UUID id,
        String issuer,
        String subject,
        String email,
        String displayName,
        Instant createdAt,
        Instant lastLoginAt
    ) {}

    public Optional<UserIdentity> findByIssuerAndSubject(String issuer, String subject) {
        String sql = """
            SELECT id, issuer, subject, email, display_name, created_at, last_login_at
            FROM user_identity
            WHERE issuer = :issuer AND subject = :subject
            """;
        
        var results = jdbc.query(sql, Map.of("issuer", issuer, "subject", subject), (rs, rowNum) ->
            new UserIdentity(
                (UUID) rs.getObject("id"),
                rs.getString("issuer"),
                rs.getString("subject"),
                rs.getString("email"),
                rs.getString("display_name"),
                rs.getTimestamp("created_at").toInstant(),
                rs.getTimestamp("last_login_at") != null 
                    ? rs.getTimestamp("last_login_at").toInstant() 
                    : null
            )
        );
        
        return results.stream().findFirst();
    }

    @Transactional
    public UserIdentity createOrUpdate(String issuer, String subject, String email, String displayName) {
        // Try to find existing
        var existing = findByIssuerAndSubject(issuer, subject);
        
        if (existing.isPresent()) {
            // Update existing
            String updateSql = """
                UPDATE user_identity
                SET email = :email,
                    display_name = :displayName,
                    last_login_at = now()
                WHERE issuer = :issuer AND subject = :subject
                RETURNING id, issuer, subject, email, display_name, created_at, last_login_at
                """;
            
            var updated = jdbc.query(updateSql, Map.of(
                "issuer", issuer,
                "subject", subject,
                "email", email != null ? email : existing.get().email(),
                "displayName", displayName != null ? displayName : existing.get().displayName()
            ), (rs, rowNum) ->
                new UserIdentity(
                    (UUID) rs.getObject("id"),
                    rs.getString("issuer"),
                    rs.getString("subject"),
                    rs.getString("email"),
                    rs.getString("display_name"),
                    rs.getTimestamp("created_at").toInstant(),
                    rs.getTimestamp("last_login_at") != null 
                        ? rs.getTimestamp("last_login_at").toInstant() 
                        : null
                )
            );
            
            return updated.get(0);
        } else {
            // Create new
            String insertSql = """
                INSERT INTO user_identity (issuer, subject, email, display_name, created_at, last_login_at)
                VALUES (:issuer, :subject, :email, :displayName, now(), now())
                RETURNING id, issuer, subject, email, display_name, created_at, last_login_at
                """;
            
            var created = jdbc.query(insertSql, Map.of(
                "issuer", issuer,
                "subject", subject,
                "email", email,
                "displayName", displayName
            ), (rs, rowNum) ->
                new UserIdentity(
                    (UUID) rs.getObject("id"),
                    rs.getString("issuer"),
                    rs.getString("subject"),
                    rs.getString("email"),
                    rs.getString("display_name"),
                    rs.getTimestamp("created_at").toInstant(),
                    rs.getTimestamp("last_login_at") != null 
                        ? rs.getTimestamp("last_login_at").toInstant() 
                        : null
                )
            );
            
            return created.get(0);
        }
    }

    @Transactional
    public void updateLastLogin(String issuer, String subject) {
        String sql = """
            UPDATE user_identity
            SET last_login_at = now()
            WHERE issuer = :issuer AND subject = :subject
            """;
        jdbc.update(sql, Map.of("issuer", issuer, "subject", subject));
    }
}

