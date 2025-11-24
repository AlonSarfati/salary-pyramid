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
}

