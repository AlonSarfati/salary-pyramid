const API_BASE = '/api';

// Types matching the backend DTOs
export type RuleDto = {
  target: string;
  expression: string;
  dependsOn: string[];
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  meta?: Record<string, string>;
};

export type RuleSet = {
  id: string;
  rules: RuleDto[];
};

export type RuleSetRequest = {
  name: string;
  tenantId: string;
  rules: RuleDto[];
};

export type RuleSetResponse = {
  rulesetId: string;
  status: string;
};

export type RuleUpdateRequest = {
  expression: string;
  dependsOn?: string[] | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  group?: string | null;
  incomeTax?: boolean | null;
  socialSecurity?: boolean | null;
  pension?: boolean | null;
  workPension?: boolean | null;
  expensesPension?: boolean | null;
  educationFund?: boolean | null;
  workPercent?: boolean | null;
};

export type ValidateRequest = {
  sampleInputs?: Record<string, number>;
};

export type ValidateIssue = {
  component?: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
};

export type ValidateResponse = {
  valid: boolean;
  issues: ValidateIssue[];
};

export type EmployeeInput = {
  id: string;
  base?: number;
  hours?: number;
  rate?: number;
  sales?: number;
  performance?: number;
  yearsOfService?: number;
  hasFamily?: number;
  isManager?: number;
  department?: string;
  status?: string;
  extra?: Record<string, number | string>;
};

export type SimEmployeeRequest = {
  tenantId: string;
  rulesetId?: string | null;
  payDay: string;
  employee: EmployeeInput;
};

export type SimEmployeeResponse = {
  components: Record<string, number>;
  total: number;
  traces?: Record<string, ComponentTrace>;
};

export type ComponentTrace = {
  component: string;
  steps: string[];
  finalLine: string | null;
};

export type SimBulkRequest = {
  tenantId: string;
  rulesetId?: string | null;
  payDay: string;
  employees: EmployeeInput[];
};

export type SimBulkResponse = {
  results: Array<{ employeeId: string; total: number; components?: Record<string, number> }>;
  totalsByComponent: Record<string, number>;
  grandTotal: number;
};

// Helper function for API calls
async function apiCall<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    ...options,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API call failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}

// Ruleset Management
export const rulesetApi = {
  // Get active rulesets for a tenant
  async getActive(tenantId: string = 'default'): Promise<{
    tenantId: string;
    ruleSets: Array<{ rulesetId: string; name: string; count: number }>;
  }> {
    return apiCall(`/rulesets/${tenantId}/active`);
  },

  // Get a specific ruleset
  async getAllRulesets(tenantId: string): Promise<Array<{ rulesetId: string; name: string; status: string }>> {
    return apiCall(`/rulesets/${encodeURIComponent(tenantId)}/all`);
  },

  async getRuleset(
    tenantId: string,
    rulesetId: string
  ): Promise<RuleSet> {
    return apiCall(`/rulesets/${tenantId}/${rulesetId}`);
  },

  // Get targets (component names) for a ruleset
  async getTargets(
    tenantId: string,
    rulesetId: string
  ): Promise<{ rulesetId: string; targets: string[] }> {
    return apiCall(`/rulesets/${tenantId}/${rulesetId}/targets`);
  },

  // Create a new ruleset (draft)
  async create(request: RuleSetRequest): Promise<RuleSetResponse> {
    return apiCall('/rulesets', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  // Publish a ruleset
  async publish(
    tenantId: string,
    rulesetId: string
  ): Promise<RuleSetResponse> {
    return apiCall(`/rulesets/${tenantId}/${rulesetId}/publish`, {
      method: 'POST',
    });
  },

  // Rename a ruleset (display name)
  async rename(
    tenantId: string,
    rulesetId: string,
    name: string
  ): Promise<{ rulesetId: string; name: string }> {
    return apiCall(`/rulesets/${tenantId}/${rulesetId}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    });
  },

  // Delete a ruleset (and its rules)
  async delete(
    tenantId: string,
    rulesetId: string
  ): Promise<{ status: string; rulesetId: string }> {
    return apiCall(`/rulesets/${tenantId}/${rulesetId}`, {
      method: 'DELETE',
    });
  },

  // Copy a ruleset (clone + optional rename)
  async copy(
    tenantId: string,
    sourceRulesetId: string,
    name?: string
  ): Promise<{ rulesetId: string; name: string; status: string }> {
    return apiCall(`/rulesets/${tenantId}/${sourceRulesetId}/copy`, {
      method: 'POST',
      body: JSON.stringify(name ? { name } : {}),
    });
  },
};

// Rule Editing
export const ruleApi = {
  // Update a rule
  async updateRule(
    tenantId: string,
    rulesetId: string,
    target: string,
    request: RuleUpdateRequest
  ): Promise<RuleSet> {
    return apiCall(`/rulesets/${tenantId}/${rulesetId}/rules/${encodeURIComponent(target)}`, {
      method: 'PUT',
      body: JSON.stringify(request),
    });
  },

  // Validate a ruleset
  async validate(
    tenantId: string,
    rulesetId: string,
    request?: ValidateRequest
  ): Promise<ValidateResponse> {
    return apiCall(`/rulesets/${tenantId}/${rulesetId}/validate`, {
      method: 'POST',
      body: JSON.stringify(request || {}),
    });
  },

  // Delete a rule
  async deleteRule(
    tenantId: string,
    rulesetId: string,
    target: string
  ): Promise<RuleSet> {
    return apiCall(`/rulesets/${tenantId}/${rulesetId}/rules/${encodeURIComponent(target)}`, {
      method: 'DELETE',
    });
  },
};

// Simulation
export type Employee = {
  employeeId: string;
  tenantId: string;
  name: string;
  data: Record<string, any>;
  createdAt: string;
  updatedAt: string;
};

export const employeeApi = {
  // List all employees for a tenant
  async list(tenantId: string): Promise<Employee[]> {
    return apiCall(`/employees?tenantId=${tenantId}`);
  },

  // Get a specific employee
  async get(tenantId: string, employeeId: string): Promise<Employee> {
    return apiCall(`/employees/${employeeId}?tenantId=${tenantId}`);
  },

  // Create a new employee
  async create(employee: {
    tenantId: string;
    employeeId: string;
    name?: string;
    data: Record<string, any>;
  }): Promise<Employee> {
    return apiCall('/employees', {
      method: 'POST',
      body: JSON.stringify(employee),
    });
  },

  // Update an employee
  async update(
    tenantId: string,
    employeeId: string,
    updates: {
      name?: string;
      data?: Record<string, any>;
    }
  ): Promise<Employee> {
    return apiCall(`/employees/${employeeId}?tenantId=${tenantId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  // Delete an employee
  async delete(tenantId: string, employeeId: string): Promise<{ status: string; employeeId: string }> {
    return apiCall(`/employees/${employeeId}?tenantId=${tenantId}`, {
      method: 'DELETE',
    });
  },
};

export const tenantApi = {
  // List all tenants
  async list(): Promise<Array<{ tenantId: string; name: string; status: string; currency: string; createdAt: string; updatedAt: string }>> {
    return apiCall('/tenants');
  },

  // Get a specific tenant
  async get(tenantId: string): Promise<{ tenantId: string; name: string; status: string; currency: string; createdAt: string; updatedAt: string }> {
    return apiCall(`/tenants/${tenantId}`);
  },

  // Create a new tenant
  async create(tenantId: string, name: string, status: string = 'ACTIVE', currency: string = 'USD'): Promise<{ tenantId: string; name: string; status: string; currency: string; createdAt: string; updatedAt: string }> {
    return apiCall('/tenants', {
      method: 'POST',
      body: JSON.stringify({ tenantId, name, status, currency }),
    });
  },

  // Update a tenant
  async update(tenantId: string, updates: { name?: string; status?: string; currency?: string }): Promise<{ tenantId: string; name: string; status: string; currency: string; createdAt: string; updatedAt: string }> {
    return apiCall(`/tenants/${tenantId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  // Delete (deactivate) a tenant
  async delete(tenantId: string): Promise<{ status: string; tenantId: string }> {
    return apiCall(`/tenants/${tenantId}`, {
      method: 'DELETE',
    });
  },
};

export const simulationApi = {
  // Simulate single employee
  async simulateEmployee(
    request: SimEmployeeRequest
  ): Promise<SimEmployeeResponse> {
    return apiCall('/simulate/employee', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  // Simulate bulk employees
  async simulateBulk(request: SimBulkRequest): Promise<SimBulkResponse> {
    return apiCall('/simulate/bulk', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  // Get required inputs for a ruleset
  async getRequiredInputs(
    tenantId: string,
    rulesetId?: string | null,
    payDay?: string
  ): Promise<Record<string, { name: string; label: string; type: string; defaultValue: any; options?: string[]; min?: number }>> {
    const params = new URLSearchParams({ tenantId });
    if (rulesetId) params.append('rulesetId', rulesetId);
    if (payDay) params.append('payDay', payDay);
    return apiCall(`/simulate/required-inputs?${params.toString()}`);
  },
};

// Table Management
export const tableApi = {
  // List all tables for a component
  async listTables(
    tenantId: string,
    component: string
  ): Promise<{ tables: Array<{ tableName: string; description: string; columns: any[] }> }> {
    return apiCall(`/tables/${tenantId}/${encodeURIComponent(component)}`);
  },

  // Get table definition and rows
  async getTable(
    tenantId: string,
    component: string,
    tableName: string
  ): Promise<{
    description: string;
    columns: any[];
    rows: Array<{
      effectiveFrom: string;
      effectiveTo: string;
      keys: any;
      value: string;
    }>;
  }> {
    return apiCall(`/tables/${tenantId}/${encodeURIComponent(component)}/${encodeURIComponent(tableName)}`);
  },

  // Create or update table definition
  async saveTableDef(
    tenantId: string,
    component: string,
    tableName: string,
    description: string,
    columns: Array<{ name: string; type: string }>
  ): Promise<{ status: string }> {
    return apiCall(`/tables/${tenantId}/${encodeURIComponent(component)}/${encodeURIComponent(tableName)}`, {
      method: 'POST',
      body: JSON.stringify({ description, columns }),
    });
  },

  // Save table rows
  async saveTableRows(
    tenantId: string,
    component: string,
    tableName: string,
    rows: Array<{
      effectiveFrom?: string;
      effectiveTo?: string;
      keys: Record<string, any>;
      value: number | string;
    }>
  ): Promise<{ upserted: number }> {
    return apiCall(`/tables/${tenantId}/${encodeURIComponent(component)}/${encodeURIComponent(tableName)}/rows`, {
      method: 'PUT',
      body: JSON.stringify({ rows }),
    });
  },
};

// Component Groups
export type ComponentGroup = {
  groupName: string;
  displayName: string;
  color: string;
  displayOrder: number;
};

export const componentGroupsApi = {
  async getAll(): Promise<ComponentGroup[]> {
    return apiCall('/component-groups');
  },
  async update(groupName: string, displayName: string, color: string, displayOrder: number): Promise<ComponentGroup> {
    return apiCall(`/component-groups/${encodeURIComponent(groupName)}`, {
      method: 'PUT',
      body: JSON.stringify({ displayName, color, displayOrder }),
    });
  },
  async delete(groupName: string): Promise<void> {
    return apiCall(`/component-groups/${encodeURIComponent(groupName)}`, {
      method: 'DELETE',
    });
  },
  async create(groupName: string, displayName: string, color: string, displayOrder: number): Promise<ComponentGroup> {
    return apiCall('/component-groups', {
      method: 'POST',
      body: JSON.stringify({ groupName, displayName, color, displayOrder }),
    });
  },
};

// Scenario Management
export type Scenario = {
  scenarioId: string;
  tenantId: string;
  name: string;
  rulesetId: string;
  payMonth: string;
  inputData: Record<string, any>;
  resultData: Record<string, any>;
  simulationType: 'single' | 'bulk';
  createdAt: string;
  updatedAt: string;
};

export type CreateScenarioRequest = {
  tenantId: string;
  name: string;
  rulesetId: string;
  payMonth: string;
  inputData: Record<string, any>;
  resultData: Record<string, any>;
  simulationType?: 'single' | 'bulk' | 'optimization';
};

export const scenarioApi = {
  async list(tenantId: string): Promise<Scenario[]> {
    return apiCall(`/scenarios?tenantId=${encodeURIComponent(tenantId)}`);
  },

  async get(tenantId: string, scenarioId: string): Promise<Scenario> {
    return apiCall(`/scenarios/${encodeURIComponent(scenarioId)}?tenantId=${encodeURIComponent(tenantId)}`);
  },

  async create(request: CreateScenarioRequest): Promise<Scenario> {
    return apiCall('/scenarios', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  async update(tenantId: string, scenarioId: string, name: string, inputData: Record<string, any>, resultData: Record<string, any>): Promise<Scenario> {
    return apiCall(`/scenarios/${encodeURIComponent(scenarioId)}?tenantId=${encodeURIComponent(tenantId)}`, {
      method: 'PUT',
      body: JSON.stringify({ name, inputData, resultData }),
    });
  },

  async delete(tenantId: string, scenarioId: string): Promise<{ status: string; scenarioId: string }> {
    return apiCall(`/scenarios/${encodeURIComponent(scenarioId)}?tenantId=${encodeURIComponent(tenantId)}`, {
      method: 'DELETE',
    });
  },

  async clearAll(tenantId: string): Promise<{ status: string; deletedCount: number }> {
    return apiCall(`/scenarios?tenantId=${encodeURIComponent(tenantId)}`, {
      method: 'DELETE',
    });
  },
};

// Baseline Dashboard API
export type BaselineSummary = {
  totalPayroll: number;
  avgPerEmployee: number;
  employeeCount: number;
  activeRulesetName: string;
  activeRulesetId: string;
  asOfDate: string;
  calculatedAt: string;
};

export type BaselineTrendPoint = {
  month: string;
  totalPayroll: number;
};

export type BaselineBreakdown = {
  categoryTotals: Record<string, number>;
  calculatedAt: string;
};

export type FullSimulationResult = {
  rulesetId: string;
  rulesetName: string;
  asOfDate: string;
  employeeResults: Array<{
    employeeId: string;
    employeeName: string | null;
    total: number;
    components: Record<string, number>;
  }>;
  componentTotals: Record<string, number>;
  grandTotal: number;
  employeeCount: number;
  calculatedAt: string;
};

export const baselineApi = {
  async getSummary(tenantId: string, asOfDate?: string, rulesetId?: string): Promise<BaselineSummary> {
    const params = new URLSearchParams({ tenantId });
    if (asOfDate) params.append('asOfDate', asOfDate);
    if (rulesetId) params.append('rulesetId', rulesetId);
    return apiCall(`/baseline/summary?${params.toString()}`);
  },

  async getTrend(tenantId: string): Promise<BaselineTrendPoint[]> {
    return apiCall(`/baseline/trend?tenantId=${encodeURIComponent(tenantId)}`);
  },

  async getBreakdown(tenantId: string, asOfDate?: string, rulesetId?: string): Promise<BaselineBreakdown> {
    const params = new URLSearchParams({ tenantId });
    if (asOfDate) params.append('asOfDate', asOfDate);
    if (rulesetId) params.append('rulesetId', rulesetId);
    return apiCall(`/baseline/breakdown?${params.toString()}`);
  },

  async getSimulationCount(tenantId: string): Promise<{ count: number }> {
    return apiCall(`/baseline/simulations/count?tenantId=${encodeURIComponent(tenantId)}`);
  },

  async runFullSimulation(tenantId: string, rulesetId: string, asOfDate?: string): Promise<FullSimulationResult> {
    const params = new URLSearchParams({ tenantId, rulesetId });
    if (asOfDate) params.append('asOfDate', asOfDate);
    return apiCall(`/baseline/full-simulation?${params.toString()}`);
  },
};

// Export all APIs
// AI Rule Assistant
export type RuleAssistantRequest = {
  prompt: string;
  rulesetId?: string;
};

export type ProposedRuleDto = {
  target: string | null;
  dependsOn: string[];
  expression: string | null;
  taxable: boolean | null;
  filters: Record<string, any>;
  effectiveFrom: string | null;
  description: string | null;
  error: string | null;
};

export type RuleAssistantResponse = {
  proposedRule: ProposedRuleDto;
  explanation: string;
  warnings: string[];
};

export const ruleAssistantApi = {
  async generateRule(tenantId: string, request: RuleAssistantRequest): Promise<RuleAssistantResponse> {
    return apiCall(`/api/rules/assistant/generate?tenantId=${encodeURIComponent(tenantId)}`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },
};

// Optimizer API
// Generic focus: one or more field conditions combined with AND
export type FocusCondition = {
  field: string;
  fieldType: 'number' | 'string';
  values?: string[]; // for string/categorical fields
  min?: number; // for numeric fields
  max?: number; // for numeric fields
};

export type FocusDefinition = {
  conditions: FocusCondition[];
  // Relative weight / intensity (e.g. 1.5, 2.0, 3.0)
  weight: number;
};

export type OptimizeRequest = {
  tenantId: string;
  rulesetId: string;
  extraBudget: number;
  strategy?: string;
  targetComponent?: string;
  targetGroup?: string;
  newComponentName?: string;
  targetTable?: string;
  tableComponent?: string;
  asOfDate?: string;
  // Optional per-run focus definition for segmented strategies
  focus?: FocusDefinition;
};

export type AdjustmentPlan = {
  strategy: string;
  targetComponent?: string | null;
  targetGroup?: string | null;
  newComponentName?: string | null;
  targetTable?: string | null;
  tableComponent?: string | null;
  percentage?: string | null;
  scalarOrFactor?: string | null;
  description: string;
};

// Backward compatibility alias
export type RaisePlan = AdjustmentPlan;

export type PayrollSummary = {
  totalCost: string;
  avgPerEmployee: string;
  employeeCount: number;
  componentTotals: Record<string, string>;
};

export type OptimizationResult = {
  rulesetId: string;
  rulesetName: string;
  extraBudget: string;
  strategy: string;
  asOfDate: string;
  calculatedAt: string;
  raisePlan: AdjustmentPlan; // Backward compatibility
  adjustmentPlan?: AdjustmentPlan; // New field
  baseline: PayrollSummary;
  optimized: PayrollSummary;
  extraCostUsed: string;
};

export const optimizerApi = {
  async optimize(request: OptimizeRequest): Promise<OptimizationResult> {
    return apiCall('/optimizer/optimize', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },
};

export default {
  ruleset: rulesetApi,
  rule: ruleApi,
  simulation: simulationApi,
  tenant: tenantApi,
  employee: employeeApi,
  table: tableApi,
  componentGroups: componentGroupsApi,
  scenario: scenarioApi,
  baseline: baselineApi,
  ruleAssistant: ruleAssistantApi,
  optimizer: optimizerApi,
};

