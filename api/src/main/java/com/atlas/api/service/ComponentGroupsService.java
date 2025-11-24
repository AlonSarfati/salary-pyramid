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
}

