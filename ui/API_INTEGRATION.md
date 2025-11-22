# UI API Integration Guide

## Overview

The UI has been fully integrated with the backend APIs. All components now properly connect to the REST endpoints for rulesets, rules, and simulation.

## API Service (`src/services/apiService.ts`)

A comprehensive API service provides type-safe access to all backend endpoints:

### Ruleset Management
- `rulesetApi.getActive(tenantId)` - Get active rulesets
- `rulesetApi.getRuleset(tenantId, rulesetId)` - Get specific ruleset
- `rulesetApi.getTargets(tenantId, rulesetId)` - Get component targets
- `rulesetApi.create(request)` - Create new ruleset
- `rulesetApi.publish(tenantId, rulesetId)` - Publish ruleset

### Rule Editing
- `ruleApi.updateRule(tenantId, rulesetId, target, request)` - Update a rule
- `ruleApi.validate(tenantId, rulesetId, request?)` - Validate ruleset

### Simulation
- `simulationApi.simulateEmployee(request)` - Simulate single employee
- `simulationApi.simulateBulk(request)` - Simulate bulk employees

## Updated Components

### RuleBuilder (`src/components/RuleBuilder.tsx`)

**Features:**
- ✅ Loads rulesets from API
- ✅ Loads and displays rules for selected ruleset
- ✅ Saves rule updates via API
- ✅ Validates ruleset via API
- ✅ Publishes ruleset via API
- ✅ Real-time validation feedback
- ✅ Error handling and loading states

**Usage:**
```tsx
<RuleBuilder tenantId="default" />
```

**Key Functions:**
- `loadRulesets()` - Fetches available rulesets
- `loadRuleset(rulesetId)` - Loads specific ruleset
- `handleSave()` - Saves rule changes
- `handleValidate()` - Validates entire ruleset
- `handlePublish()` - Publishes ruleset

### SimulateSingle (`src/components/SimulateSingle.tsx`)

**Features:**
- ✅ Loads rulesets from API
- ✅ Runs simulation via API
- ✅ Displays real results from backend
- ✅ Supports all employee input fields
- ✅ Error handling and loading states

**Usage:**
```tsx
<SimulateSingle tenantId="default" />
```

**Key Functions:**
- `handleRun()` - Executes simulation with current inputs
- Displays results in formatted table
- Shows component breakdown with contribution percentages

### App.tsx

**Updates:**
- ✅ Passes `tenantId` to all components
- ✅ Maps tenant display names to tenant IDs
- ✅ Maintains tenant selection state

## API Endpoints Used

### Rulesets
- `GET /api/rulesets/{tenantId}/active` - Get active rulesets
- `GET /api/rulesets/{tenantId}/{rulesetId}` - Get ruleset details
- `GET /api/rulesets/{tenantId}/{rulesetId}/targets` - Get component targets
- `POST /api/rulesets` - Create ruleset
- `POST /api/rulesets/{tenantId}/{rulesetId}/publish` - Publish ruleset

### Rules
- `PUT /api/rulesets/{tenantId}/{rulesetId}/rules/{target}` - Update rule
- `POST /api/rulesets/{tenantId}/{rulesetId}/validate` - Validate ruleset

### Simulation
- `POST /api/simulate/employee` - Simulate single employee
- `POST /api/simulate/bulk` - Simulate bulk employees

## Request/Response Types

All types are defined in `apiService.ts`:

### RuleDto
```typescript
{
  target: string;
  expression: string;
  dependsOn: string[];
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  meta?: Record<string, string>;
}
```

### RuleUpdateRequest
```typescript
{
  expression: string;
  dependsOn?: string[] | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  taxable?: boolean | null;
  group?: string | null;
}
```

### SimEmployeeRequest
```typescript
{
  tenantId: string;
  rulesetId?: string | null;
  payDay: string;
  employee: EmployeeInput;
}
```

### SimEmployeeResponse
```typescript
{
  components: Record<string, number>;
  total: number;
}
```

## Error Handling

All API calls include proper error handling:
- Network errors are caught and displayed
- Validation errors show specific messages
- Loading states prevent duplicate requests
- User-friendly error messages

## Proxy Configuration

The Vite dev server is configured to proxy API requests:

```typescript
// vite.config.ts
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8080',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, '')
    }
  }
}
```

This means:
- Frontend calls: `/api/rulesets/...`
- Proxied to: `http://localhost:8080/rulesets/...`

## Testing the Integration

1. **Start the backend:**
   ```bash
   cd api
   mvn spring-boot:run
   ```

2. **Start the frontend:**
   ```bash
   cd ui
   npm run dev
   ```

3. **Test Rule Builder:**
   - Navigate to Rules page
   - Select a ruleset
   - Edit a rule expression
   - Click "Save Draft"
   - Click "Validate" to check for errors
   - Click "Publish" to activate

4. **Test Simulation:**
   - Navigate to Simulate page
   - Select a ruleset
   - Enter employee data
   - Click "Run Simulation"
   - View results

## Future Enhancements

- [ ] Add caching for rulesets
- [ ] Implement optimistic updates
- [ ] Add retry logic for failed requests
- [ ] Implement real-time validation as user types
- [ ] Add undo/redo for rule edits
- [ ] Export/import rulesets
- [ ] Version history for rulesets

