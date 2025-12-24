package com.atlas.api.controller;

import com.atlas.api.service.ComponentGroupsService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/component-groups")
public class ComponentGroupsController {
    private final ComponentGroupsService groupsService;

    public ComponentGroupsController(ComponentGroupsService groupsService) {
        this.groupsService = groupsService;
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getAllGroups() {
        List<ComponentGroupsService.GroupDto> groups = groupsService.getAllGroups();
        List<Map<String, Object>> response = groups.stream()
            .map(ComponentGroupsService.GroupDto::toMap)
            .toList();
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{groupName}")
    public ResponseEntity<Map<String, Object>> updateGroup(
            @PathVariable String groupName,
            @RequestBody Map<String, Object> request) {
        try {
            // Spring automatically URL-decodes path variables, but handle spaces that might be encoded
            // Replace %20 with space, and handle other common encodings
            String normalizedGroupName = groupName.replace("%20", " ").replace("+", " ");
            
            String newGroupName = (String) request.get("groupName");
            String displayName = (String) request.get("displayName");
            String color = (String) request.get("color");
            Integer displayOrder = request.get("displayOrder") instanceof Number 
                ? ((Number) request.get("displayOrder")).intValue() 
                : null;

            if (displayName == null || color == null || displayOrder == null) {
                return ResponseEntity.badRequest().build();
            }

            ComponentGroupsService.GroupDto updated = groupsService.updateGroup(
                normalizedGroupName, newGroupName, displayName, color, displayOrder);
            return ResponseEntity.ok(updated.toMap());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @DeleteMapping("/{groupName}")
    public ResponseEntity<Void> deleteGroup(@PathVariable String groupName) {
        try {
            // Spring automatically URL-decodes path variables, but handle spaces that might be encoded
            // Replace %20 with space, and handle other common encodings
            String normalizedGroupName = groupName.replace("%20", " ").replace("+", " ");
            groupsService.deleteGroup(normalizedGroupName);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> createGroup(@RequestBody Map<String, Object> request) {
        String groupName = (String) request.get("groupName");
        String displayName = (String) request.get("displayName");
        String color = (String) request.get("color");
        Integer displayOrder = request.get("displayOrder") instanceof Number 
            ? ((Number) request.get("displayOrder")).intValue() 
            : null;

        if (groupName == null || displayName == null || color == null || displayOrder == null) {
            return ResponseEntity.badRequest().build();
        }

        ComponentGroupsService.GroupDto created = groupsService.createGroup(
            groupName, displayName, color, displayOrder);
        return ResponseEntity.ok(created.toMap());
    }
}

