package com.atlas.api.service;

import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Array;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;

@Service
public class TenantSettingsService {
    private final NamedParameterJdbcTemplate jdbc;
    private final AuditService auditService;

    public TenantSettingsService(NamedParameterJdbcTemplate jdbc, AuditService auditService) {
        this.jdbc = jdbc;
        this.auditService = auditService;
    }

    public record TenantSettingsDto(
        String tenantId,
        String name,
        String timezone,
        String currency,
        String locale,
        String rounding,
        Integer retentionDays,
        Boolean exportCsv,
        Boolean exportXlsx,
        Boolean exportPdf,
        Integer sessionTimeoutMinutes,
        List<String> allowedEmailDomains,
        Boolean requireSso,
        Instant createdAt,
        Instant updatedAt
    ) {}

    public Optional<TenantSettingsDto> getSettings(String tenantId) {
        String sql = """
            SELECT 
                tenant_id, name, timezone, currency, locale, rounding,
                retention_days, export_csv, export_xlsx, export_pdf,
                session_timeout_minutes, allowed_email_domains,
                require_sso, created_at, updated_at
            FROM tenant_settings
            WHERE tenant_id = :tenantId
            """;
        
        var results = jdbc.query(sql, Map.of("tenantId", tenantId), (rs, rowNum) -> {
            List<String> domains = List.of();
            Array domainsArray = rs.getArray("allowed_email_domains");
            if (domainsArray != null) {
                String[] domainsArr = (String[]) domainsArray.getArray();
                domains = Arrays.asList(domainsArr);
            }
            
            return new TenantSettingsDto(
                rs.getString("tenant_id"),
                rs.getString("name"),
                rs.getString("timezone"),
                rs.getString("currency"),
                rs.getString("locale"),
                rs.getString("rounding"),
                rs.getInt("retention_days"),
                rs.getBoolean("export_csv"),
                rs.getBoolean("export_xlsx"),
                rs.getBoolean("export_pdf"),
                rs.getInt("session_timeout_minutes"),
                domains,
                rs.getBoolean("require_sso"),
                rs.getTimestamp("created_at").toInstant(),
                rs.getTimestamp("updated_at").toInstant()
            );
        });
        
        return results.isEmpty() ? Optional.empty() : Optional.of(results.get(0));
    }

    @Transactional
    public TenantSettingsDto updateSettings(String tenantId, Map<String, Object> updates, String actorUserId, String actorSource) {
        // Get old settings for audit diff
        var oldSettings = getSettings(tenantId).orElse(null);
        Map<String, Object> diff = new HashMap<>();
        
        if (oldSettings != null) {
            if (updates.containsKey("name") && !Objects.equals(updates.get("name"), oldSettings.name())) {
                diff.put("name", Map.of("old", oldSettings.name(), "new", updates.get("name")));
            }
            if (updates.containsKey("timezone") && !Objects.equals(updates.get("timezone"), oldSettings.timezone())) {
                diff.put("timezone", Map.of("old", oldSettings.timezone(), "new", updates.get("timezone")));
            }
            if (updates.containsKey("currency") && !Objects.equals(updates.get("currency"), oldSettings.currency())) {
                diff.put("currency", Map.of("old", oldSettings.currency(), "new", updates.get("currency")));
            }
            if (updates.containsKey("requireSso") && !Objects.equals(updates.get("requireSso"), oldSettings.requireSso())) {
                diff.put("requireSso", Map.of("old", oldSettings.requireSso(), "new", updates.get("requireSso")));
            }
            // Add more fields as needed
        }
        
        // Build dynamic update query
        Map<String, Object> params = new HashMap<>(Map.of("tenantId", tenantId));
        StringBuilder sql = new StringBuilder("UPDATE tenant_settings SET updated_at = now()");
        
        if (updates.containsKey("name")) {
            sql.append(", name = :name");
            params.put("name", updates.get("name"));
        }
        if (updates.containsKey("timezone")) {
            sql.append(", timezone = :timezone");
            params.put("timezone", updates.get("timezone"));
        }
        if (updates.containsKey("currency")) {
            sql.append(", currency = :currency");
            params.put("currency", updates.get("currency"));
        }
        if (updates.containsKey("locale")) {
            sql.append(", locale = :locale");
            params.put("locale", updates.get("locale"));
        }
        if (updates.containsKey("rounding")) {
            sql.append(", rounding = :rounding");
            params.put("rounding", updates.get("rounding"));
        }
        if (updates.containsKey("retentionDays")) {
            sql.append(", retention_days = :retentionDays");
            params.put("retentionDays", updates.get("retentionDays"));
        }
        if (updates.containsKey("exportCsv")) {
            sql.append(", export_csv = :exportCsv");
            params.put("exportCsv", updates.get("exportCsv"));
        }
        if (updates.containsKey("exportXlsx")) {
            sql.append(", export_xlsx = :exportXlsx");
            params.put("exportXlsx", updates.get("exportXlsx"));
        }
        if (updates.containsKey("exportPdf")) {
            sql.append(", export_pdf = :exportPdf");
            params.put("exportPdf", updates.get("exportPdf"));
        }
        if (updates.containsKey("sessionTimeoutMinutes")) {
            sql.append(", session_timeout_minutes = :sessionTimeoutMinutes");
            params.put("sessionTimeoutMinutes", updates.get("sessionTimeoutMinutes"));
        }
        if (updates.containsKey("allowedEmailDomains")) {
            sql.append(", allowed_email_domains = :allowedEmailDomains");
            @SuppressWarnings("unchecked")
            List<String> domains = (List<String>) updates.get("allowedEmailDomains");
            params.put("allowedEmailDomains", domains != null ? domains.toArray(new String[0]) : new String[0]);
        }
        if (updates.containsKey("requireSso")) {
            sql.append(", require_sso = :requireSso");
            params.put("requireSso", updates.get("requireSso"));
        }
        
        sql.append(" WHERE tenant_id = :tenantId");
        
        int updated = jdbc.update(sql.toString(), params);
        
        if (updated == 0) {
            throw new IllegalArgumentException("Tenant settings not found");
        }
        
        // Log audit event
        if (!diff.isEmpty()) {
            auditService.logEvent(
                tenantId,
                actorUserId,
                actorSource,
                "SETTINGS_UPDATED",
                "SETTINGS",
                tenantId,
                diff,
                "Tenant settings updated"
            );
        }
        
        return getSettings(tenantId).orElseThrow();
    }
}

