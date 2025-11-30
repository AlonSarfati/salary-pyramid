package com.atlas.api.service;

import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class ComponentGroupsService {
    private final NamedParameterJdbcTemplate jdbc;

    public ComponentGroupsService(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record GroupDto(
        String groupName,
        String displayName,
        String color,
        int displayOrder
    ) {
        public Map<String, Object> toMap() {
            return Map.of(
                "groupName", groupName,
                "displayName", displayName,
                "color", color,
                "displayOrder", displayOrder
            );
        }
    }

    public List<GroupDto> getAllGroups() {
        String sql = """
            SELECT group_name, display_name, color, display_order
            FROM component_groups
            ORDER BY display_order, group_name
            """;

        return jdbc.query(sql, Map.of(), (rs, rowNum) -> 
            new GroupDto(
                rs.getString("group_name"),
                rs.getString("display_name"),
                rs.getString("color"),
                rs.getInt("display_order")
            )
        );
    }

    public GroupDto updateGroup(String groupName, String displayName, String color, int displayOrder) {
        // Normalize group name to lowercase for lookup (group names are stored in lowercase)
        String normalizedGroupName = groupName.toLowerCase().trim();
        
        // First check if group exists
        String checkSql = """
            SELECT group_name FROM component_groups WHERE LOWER(TRIM(group_name)) = :groupName
            """;
        List<String> existing = jdbc.query(checkSql, Map.of("groupName", normalizedGroupName), 
            (rs, rowNum) -> rs.getString("group_name"));
        
        if (existing.isEmpty()) {
            // List all available groups for better error message
            List<String> allGroups = jdbc.query("SELECT group_name FROM component_groups ORDER BY group_name", Map.of(),
                (rs, rowNum) -> rs.getString("group_name"));
            throw new IllegalArgumentException("Group not found: " + groupName + 
                ". Available groups: " + String.join(", ", allGroups));
        }
        
        // Get the actual group name from database (to preserve exact casing/spacing)
        String actualGroupName = existing.get(0);
        
        String sql = """
            UPDATE component_groups
            SET display_name = :displayName,
                color = :color,
                display_order = :displayOrder,
                updated_at = now()
            WHERE group_name = :actualGroupName
            RETURNING group_name, display_name, color, display_order
            """;

        Map<String, Object> params = Map.of(
            "actualGroupName", actualGroupName,
            "displayName", displayName,
            "color", color,
            "displayOrder", displayOrder
        );

        List<GroupDto> results = jdbc.query(sql, params, (rs, rowNum) -> 
            new GroupDto(
                rs.getString("group_name"),
                rs.getString("display_name"),
                rs.getString("color"),
                rs.getInt("display_order")
            )
        );

        if (results.isEmpty()) {
            throw new IllegalArgumentException("Failed to update group: " + groupName);
        }

        return results.get(0);
    }

    public void deleteGroup(String groupName) {
        // Normalize group name to lowercase for lookup (group names are stored in lowercase)
        String normalizedGroupName = groupName.toLowerCase().trim();
        
        // First check if group exists
        String checkSql = """
            SELECT group_name FROM component_groups WHERE LOWER(TRIM(group_name)) = :groupName
            """;
        List<String> existing = jdbc.query(checkSql, Map.of("groupName", normalizedGroupName), 
            (rs, rowNum) -> rs.getString("group_name"));
        
        if (existing.isEmpty()) {
            // List all available groups for better error message
            List<String> allGroups = jdbc.query("SELECT group_name FROM component_groups ORDER BY group_name", Map.of(),
                (rs, rowNum) -> rs.getString("group_name"));
            throw new IllegalArgumentException("Group not found: " + groupName + 
                ". Available groups: " + String.join(", ", allGroups));
        }
        
        // Get the actual group name from database (to preserve exact casing/spacing)
        String actualGroupName = existing.get(0);
        
        String sql = """
            DELETE FROM component_groups
            WHERE group_name = :actualGroupName
            """;

        int rowsAffected = jdbc.update(sql, Map.of("actualGroupName", actualGroupName));
        if (rowsAffected == 0) {
            throw new IllegalArgumentException("Failed to delete group: " + groupName);
        }
    }

    public GroupDto createGroup(String groupName, String displayName, String color, int displayOrder) {
        String sql = """
            INSERT INTO component_groups (group_name, display_name, color, display_order)
            VALUES (:groupName, :displayName, :color, :displayOrder)
            RETURNING group_name, display_name, color, display_order
            """;

        Map<String, Object> params = Map.of(
            "groupName", groupName,
            "displayName", displayName,
            "color", color,
            "displayOrder", displayOrder
        );

        List<GroupDto> results = jdbc.query(sql, params, (rs, rowNum) -> 
            new GroupDto(
                rs.getString("group_name"),
                rs.getString("display_name"),
                rs.getString("color"),
                rs.getInt("display_order")
            )
        );

        return results.get(0);
    }
}

