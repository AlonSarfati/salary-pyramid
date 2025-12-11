import React, { useState, useEffect, useRef } from 'react';
import { Upload, Play, Download, Users, Loader2, Plus, Trash2, X } from 'lucide-react';
import { Card } from './ui/card';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { Button } from './ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { rulesetApi, simulationApi, employeeApi, type EmployeeInput, type SimBulkResponse, type Employee } from '../services/apiService';
import { useToast } from "./ToastProvider";
import { useCurrency } from '../hooks/useCurrency';
import { formatCurrency as formatCurrencyUtil } from '../utils/currency';

export default function SimulateBulk({ tenantId = "default" }: { tenantId?: string }) {
  const { showToast } = useToast();
  const currency = useCurrency(tenantId);
  const [hasData, setHasData] = useState(false);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simulationError, setSimulationError] = useState<string | null>(null);

  // Ruleset state
  const [rulesets, setRulesets] = useState<Array<{ rulesetId: string; name: string; count: number }>>([]);
  const [selectedRulesetId, setSelectedRulesetId] = useState<string | null>(null);
  const [rulesLoading, setRulesLoading] = useState(false);
  
  // Global ruleset persistence key
  const GLOBAL_RULESET_KEY = `globalRuleset_${tenantId}`;

  // Form state
  const [payMonth, setPayMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM format

  // Dynamic input state
  const [requiredInputs, setRequiredInputs] = useState<Record<string, { name: string; label: string; type: string; defaultValue: any; options?: string[]; min?: number }>>({});
  const [inputsLoading, setInputsLoading] = useState(false);

  // Employees state
  const [employees, setEmployees] = useState<Array<{ id: string; inputs: Record<string, any> }>>([]);
  
  // Saved employees state (from database)
  const [savedEmployees, setSavedEmployees] = useState<Employee[]>([]);
  const [savedEmployeesLoading, setSavedEmployeesLoading] = useState(false);
  
  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Array<{ field: string; operator: string; value: string }>>([]);
  const [availableFields, setAvailableFields] = useState<string[]>([]);

  // Results state
  const [simulationResult, setSimulationResult] = useState<SimBulkResponse | null>(null);
  const [baselineResult, setBaselineResult] = useState<SimBulkResponse | null>(null);
  const [baselineRulesetId, setBaselineRulesetId] = useState<string | null>(null);
  const [baselinePayMonth, setBaselinePayMonth] = useState<string>('');
  
  // Ref for scrolling to results
  const resultsRef = useRef<HTMLDivElement>(null);

  // Fetch rulesets
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setRulesLoading(true);
        const data = await rulesetApi.getActive(tenantId);
        if (!cancelled) {
          setRulesets(data.ruleSets || []);
          if (data.ruleSets && data.ruleSets.length > 0) {
            let initialRulesetId = data.ruleSets[0].rulesetId;
            
            // Try to restore from global storage
            const storedGlobalRuleset = localStorage.getItem(GLOBAL_RULESET_KEY);
            if (storedGlobalRuleset) {
              try {
                const { rulesetId: storedId } = JSON.parse(storedGlobalRuleset);
                if (data.ruleSets.some(rs => rs.rulesetId === storedId)) {
                  initialRulesetId = storedId;
                }
              } catch (e) {
                console.warn('Failed to parse global ruleset from localStorage:', e);
              }
            }
            
            setSelectedRulesetId(initialRulesetId);
          }
        }
      } catch (e: any) {
        console.error('Failed to load rulesets:', e);
      } finally {
        if (!cancelled) setRulesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tenantId]);

  // Fetch required inputs when ruleset changes
  useEffect(() => {
    if (!selectedRulesetId) return;
    
    let cancelled = false;
    (async () => {
      try {
        setInputsLoading(true);
        const payDay = payMonth ? `${payMonth}-01` : new Date().toISOString().slice(0, 10);
        const response = await fetch(
          `/api/simulate/required-inputs?tenantId=${tenantId}&rulesetId=${selectedRulesetId}&payDay=${payDay}`
        );
        if (!response.ok) throw new Error('Failed to fetch required inputs');
        const inputs = await response.json();
        if (!cancelled) {
          setRequiredInputs(inputs);
        }
      } catch (e: any) {
        console.error('Failed to load required inputs:', e);
      } finally {
        if (!cancelled) setInputsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedRulesetId, tenantId, payMonth]);

  // Load saved employees on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setSavedEmployeesLoading(true);
        const employees = await employeeApi.list(tenantId);
        if (!cancelled) {
          setSavedEmployees(employees);
          // Extract available fields from employee data
          const fields = new Set<string>();
          employees.forEach(emp => {
            Object.keys(emp.data || {}).forEach(key => fields.add(key));
          });
          setAvailableFields(Array.from(fields).sort());
        }
      } catch (e: any) {
        console.error('Failed to load employees:', e);
        showToast("error", "Failed to load employees", e.message || "Unknown error");
      } finally {
        if (!cancelled) setSavedEmployeesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tenantId]);

  const handleAddEmployee = () => {
    const newEmployee = {
      id: `E${String(employees.length + 1).padStart(3, '0')}`,
      inputs: Object.fromEntries(
        Object.entries(requiredInputs).map(([key, meta]) => [key, meta.defaultValue || (meta.type === 'number' ? 0 : meta.type === 'boolean' ? false : '')])
      ),
    };
    setEmployees([...employees, newEmployee]);
  };

  const handleSelectSavedEmployee = (employee: Employee) => {
    // Create a new employee entry with data from saved employee
    const newEmployee = {
      id: employee.employeeId,
      inputs: { ...employee.data },
    };
    setEmployees([...employees, newEmployee]);
  };

  // Filter employees based on criteria
  const getFilteredEmployees = (): Employee[] => {
    if (filters.length === 0) return savedEmployees;
    
    return savedEmployees.filter(emp => {
      return filters.every(filter => {
        const fieldValue = emp.data?.[filter.field];
        const filterValue = filter.value;
        
        if (fieldValue === undefined || fieldValue === null) {
          return filter.operator === 'is_empty';
        }
        
        switch (filter.operator) {
          case 'equals':
            return String(fieldValue).toLowerCase() === filterValue.toLowerCase();
          case 'contains':
            return String(fieldValue).toLowerCase().includes(filterValue.toLowerCase());
          case 'greater_than':
            return Number(fieldValue) > Number(filterValue);
          case 'less_than':
            return Number(fieldValue) < Number(filterValue);
          case 'greater_equal':
            return Number(fieldValue) >= Number(filterValue);
          case 'less_equal':
            return Number(fieldValue) <= Number(filterValue);
          case 'is_empty':
            return fieldValue === undefined || fieldValue === null || String(fieldValue).trim() === '';
          case 'is_not_empty':
            return fieldValue !== undefined && fieldValue !== null && String(fieldValue).trim() !== '';
          default:
            return true;
        }
      });
    });
  };

  const handleLoadFilteredEmployees = () => {
    const filtered = getFilteredEmployees();
    if (filtered.length === 0) {
      showToast("info", "No matches", "No employees match the current filters.");
      return;
    }
    
    // Convert filtered employees to simulation format
    const newEmployees = filtered.map(emp => ({
      id: emp.employeeId,
      inputs: { ...emp.data },
    }));
    
    // Merge with existing employees, avoiding duplicates
    const existingIds = new Set(employees.map(e => e.id));
    const uniqueNewEmployees = newEmployees.filter(e => !existingIds.has(e.id));
    
    if (uniqueNewEmployees.length === 0) {
      showToast("info", "Already added", "All matching employees are already in the list.");
      return;
    }
    
    setEmployees([...employees, ...uniqueNewEmployees]);
    showToast("success", "Employees loaded", `Added ${uniqueNewEmployees.length} employee(s) to the simulation.`);
  };

  const handleRemoveFilteredEmployees = () => {
    const filtered = getFilteredEmployees();
    if (filtered.length === 0) {
      showToast("info", "No matches", "No employees match the current filters.");
      return;
    }
    
    // Get IDs of filtered employees
    const filteredIds = new Set(filtered.map(emp => emp.employeeId));
    
    // Remove employees that match the filter
    const remainingEmployees = employees.filter(emp => !filteredIds.has(emp.id));
    
    const removedCount = employees.length - remainingEmployees.length;
    
    if (removedCount === 0) {
      showToast("info", "No matches", "No employees in the simulation list match the current filters.");
      return;
    }
    
    setEmployees(remainingEmployees);
    showToast("success", "Employees removed", `Removed ${removedCount} employee(s) from the simulation.`);
  };

  const handleAddFilter = () => {
    setFilters([...filters, { field: availableFields[0] || '', operator: 'equals', value: '' }]);
  };

  const handleRemoveFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  const handleFilterChange = (index: number, field: 'field' | 'operator' | 'value', value: string) => {
    const updated = [...filters];
    updated[index] = { ...updated[index], [field]: value };
    setFilters(updated);
  };

  const handleSaveEmployee = async (index: number) => {
    const emp = employees[index];
    if (!emp.id || emp.id.trim() === '') {
      showToast("error", "Missing Employee ID", "Please enter an Employee ID before saving.");
      return;
    }

    try {
      await employeeApi.create({
        tenantId,
        employeeId: emp.id,
        name: emp.id, // Use ID as name if no name field
        data: emp.inputs,
      });
      
      // Refresh saved employees list
      const updated = await employeeApi.list(tenantId);
      setSavedEmployees(updated);
      showToast("success", "Employee saved", `Employee ${emp.id} was saved successfully.`);
    } catch (e: any) {
      showToast("error", "Failed to save employee", e.message || "Unknown error");
      console.error('Failed to save employee:', e);
    }
  };

  const handleRemoveEmployee = (index: number) => {
    setEmployees(employees.filter((_, i) => i !== index));
  };

  const handleEmployeeInputChange = (index: number, inputName: string, value: any) => {
    const updated = [...employees];
    updated[index].inputs[inputName] = value;
    setEmployees(updated);
  };

  const handleCSVUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim());

      const parsed: Array<{ id: string; inputs: Record<string, any> }> = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const employee: { id: string; inputs: Record<string, any> } = {
          id: values[0] || `E${String(i).padStart(3, '0')}`,
          inputs: {},
        };

        for (let j = 1; j < headers.length && j < values.length; j++) {
          const header = headers[j];
          const value = values[j];
          const meta = requiredInputs[header];
          if (meta) {
            if (meta.type === 'number') {
              employee.inputs[header] = parseFloat(value) || 0;
            } else if (meta.type === 'boolean') {
              employee.inputs[header] = value.toLowerCase() === 'true' || value === '1';
            } else {
              employee.inputs[header] = value;
            }
          }
        }
        parsed.push(employee);
      }

      setEmployees(parsed);
      setHasData(parsed.length > 0);
    };
    reader.readAsText(file);
  };

  const handleRunSimulation = async (isBaseline = false) => {
    if (employees.length === 0) {
      showToast("error", "No employees", "Please add at least one employee before running a simulation.");
      return;
    }

    try {
      setSimulating(true);
      setSimulationError(null);

      const payDay = payMonth ? `${payMonth}-01` : new Date().toISOString().slice(0, 10);
      
      const employeeInputs: EmployeeInput[] = employees.map(emp => ({
        id: emp.id,
        ...emp.inputs,
        extra: emp.inputs, // Put all inputs in extra for now
      }));

      const result = await simulationApi.simulateBulk({
        tenantId,
        rulesetId: selectedRulesetId,
        payDay,
        employees: employeeInputs,
      });

      if (isBaseline) {
        setBaselineResult(result);
        setBaselineRulesetId(selectedRulesetId);
        setBaselinePayMonth(payMonth);
        showToast("success", "Baseline Simulation Complete", `Simulated ${employees.length} employee(s) successfully.`);
      } else {
        setSimulationResult(result);
        setHasData(true);
        
        // Format currency for toast message (currency is defined at component level)
        const formattedTotal = formatCurrencyUtil(Number(result.grandTotal), currency);
        showToast("success", "Simulation Complete", `Simulated ${employees.length} employee(s) successfully. Total cost: ${formattedTotal}`);
        
        // Scroll to results after a short delay to ensure DOM is updated
        setTimeout(() => {
          resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    } catch (e: any) {
      setSimulationError(e.message || 'Failed to run simulation');
      showToast("error", "Simulation Failed", e.message || 'Failed to run simulation');
      console.error('Simulation error:', e);
    } finally {
      setSimulating(false);
    }
  };

  const handleSetBaseline = () => {
    if (!simulationResult) {
      showToast("error", "No run to set as baseline", "Run a simulation first, then set it as baseline.");
      return;
    }
    setBaselineResult(simulationResult);
    setBaselineRulesetId(selectedRulesetId);
    setBaselinePayMonth(payMonth);
    // Enable comparison mode if it's not already enabled
    if (!comparisonMode) {
      setComparisonMode(true);
    }
  };

  // Prepare chart data from results
  const componentData = simulationResult
    ? Object.entries(simulationResult.totalsByComponent)
        .map(([name, amount]) => ({ name, amount: Number(amount) }))
        .sort((a, b) => b.amount - a.amount)
    : [];

  // Prepare employee results with comparison
  const employeeResults = simulationResult
    ? simulationResult.results.map((r) => {
        const baseline = baselineResult?.results.find((b) => b.employeeId === r.employeeId);
        const baselineTotal = baseline ? Number(baseline.total) : 0;
        const currentTotal = Number(r.total);
        return {
          id: r.employeeId,
          total: currentTotal,
          baselineTotal: comparisonMode && baselineResult ? baselineTotal : null,
          delta: comparisonMode && baselineResult ? currentTotal - baselineTotal : 0,
          components: r.components || {},
          baselineComponents: baseline?.components || {},
        };
      })
    : [];

  // State for employee breakdown dialog
  const [selectedEmployee, setSelectedEmployee] = useState<typeof employeeResults[0] | null>(null);

  // Prepare component data with comparison
  const componentDataWithComparison = componentData.map(comp => {
    if (!comparisonMode || !baselineResult) {
      return { ...comp, baselineAmount: null, delta: null };
    }
    const baselineAmount = Number(baselineResult.totalsByComponent[comp.name] || 0);
    return {
      ...comp,
      baselineAmount,
      delta: comp.amount - baselineAmount,
    };
  });

  // Format currency using utility
  const formatCurrency = (amount: number) => {
    return formatCurrencyUtil(amount, currency);
  };

  return (
    <div className="max-w-[1600px] mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
        <h2 className="text-[#1E1E1E]">Bulk / Segment Simulation</h2>
        <div className="flex items-center gap-3">
          <Label htmlFor="comparison" className="text-[#1E1E1E]">Comparison Mode</Label>
          <Switch
            id="comparison"
            checked={comparisonMode}
            onCheckedChange={(checked) => {
              if (checked) {
                // If turning on comparison mode and no baseline exists, use current result as baseline
                if (!baselineResult && simulationResult) {
                  setBaselineResult(simulationResult);
                  setBaselineRulesetId(selectedRulesetId);
                  setBaselinePayMonth(payMonth);
                }
                setComparisonMode(true);
              } else {
                setComparisonMode(false);
              }
            }}
            disabled={!simulationResult && !baselineResult}
          />
          {baselineResult && (
            <span className="text-xs text-gray-500">
              Baseline: {baselineRulesetId ? rulesets.find(r => r.rulesetId === baselineRulesetId)?.name : 'N/A'} ({baselinePayMonth})
            </span>
          )}
        </div>
      </div>

      {/* Configuration Section */}
      <Card className="p-6 bg-white rounded-xl shadow-sm border-0 mb-6">
        <h3 className="text-[#1E1E1E] mb-4">Configuration</h3>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-end">
          <div className="lg:col-span-2">
            <Label htmlFor="ruleset">Ruleset</Label>
            <Select
              value={selectedRulesetId || ''}
              onValueChange={(value) => {
                setSelectedRulesetId(value || null);
                const selected = rulesets.find(rs => rs.rulesetId === value);
                const name = selected?.name || value;
                localStorage.setItem(GLOBAL_RULESET_KEY, JSON.stringify({ rulesetId: value, name }));
              }}
              disabled={rulesLoading}
            >
              <SelectTrigger id="ruleset" className="mt-1">
                <SelectValue placeholder={rulesLoading ? "Loading..." : "Select ruleset..."} />
              </SelectTrigger>
              <SelectContent>
                {rulesets.map((rs) => (
                  <SelectItem key={rs.rulesetId} value={rs.rulesetId}>
                    {rs.name} ({rs.count} rules)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="payMonth">Pay Month</Label>
            <Input
              id="payMonth"
              type="month"
              value={payMonth}
              onChange={(e) => setPayMonth(e.target.value)}
              className="mt-1"
            />
          </div>

          <div className="flex items-end gap-2">
            <label className="flex-1">
              <input
                type="file"
                accept=".csv"
                onChange={handleCSVUpload}
                className="hidden"
                id="csv-upload"
              />
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => document.getElementById('csv-upload')?.click()}
                title="Upload CSV file"
              >
                <Upload className="w-4 h-4" />
              </Button>
            </label>
            {simulationResult && (
              <Button
                onClick={handleSetBaseline}
                variant="outline"
                className="whitespace-nowrap"
                title="Set current result as baseline for comparison"
              >
                Baseline
              </Button>
            )}
            <Button
              onClick={() => handleRunSimulation(false)}
              disabled={simulating || employees.length === 0 || !selectedRulesetId}
              className="flex-1"
            >
              {simulating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Run
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>

      {simulationError && (
        <Card className="p-4 bg-red-50 border border-red-200 rounded-xl mb-6">
          <p className="text-red-700 text-sm">{simulationError}</p>
        </Card>
      )}

      {/* Employees Input Section */}
      <Card className="p-6 bg-white rounded-xl shadow-sm border-0 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[#1E1E1E]">Employees</h3>
          <div className="flex items-center gap-2">
            {savedEmployees.length > 0 && (
              <>
                <Button
                  onClick={() => setShowFilters(!showFilters)}
                  variant="outline"
                  size="sm"
                >
                  <Users className="w-4 h-4 mr-2" />
                  Filter & Load
                </Button>
                <Select
                  value=""
                  onValueChange={(value) => {
                    const employee = savedEmployees.find(e => e.employeeId === value);
                    if (employee) {
                      handleSelectSavedEmployee(employee);
                    }
                  }}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select saved employee..." />
                  </SelectTrigger>
                  <SelectContent>
                    {savedEmployees.map((emp) => (
                      <SelectItem key={emp.employeeId} value={emp.employeeId}>
                        {emp.name || emp.employeeId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
            <Button onClick={handleAddEmployee} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Employee
            </Button>
          </div>
        </div>

        {/* Filter Section */}
        {showFilters && savedEmployees.length > 0 && (
          <Card className="p-4 mb-4 bg-gray-50 border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-700">Filter Employees</h4>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600">
                  {getFilteredEmployees().length} of {savedEmployees.length} employees match
                </span>
                <Button onClick={handleAddFilter} size="sm" variant="outline">
                  <Plus className="w-3 h-3 mr-1" />
                  Add Filter
                </Button>
              </div>
            </div>
            
            {filters.length === 0 ? (
              <p className="text-sm text-gray-500 mb-3">No filters applied. Click "Add Filter" to start filtering.</p>
            ) : (
              <div className="space-y-2 mb-3">
                {filters.map((filter, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 bg-white rounded border border-gray-200">
                    <Select
                      value={filter.field}
                      onValueChange={(value) => handleFilterChange(idx, 'field', value)}
                    >
                      <SelectTrigger className="w-[150px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableFields.map(field => (
                          <SelectItem key={field} value={field}>{field}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={filter.operator}
                      onValueChange={(value) => handleFilterChange(idx, 'operator', value)}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="equals">Equals</SelectItem>
                        <SelectItem value="contains">Contains</SelectItem>
                        <SelectItem value="greater_than">Greater than</SelectItem>
                        <SelectItem value="less_than">Less than</SelectItem>
                        <SelectItem value="greater_equal">Greater or equal</SelectItem>
                        <SelectItem value="less_equal">Less or equal</SelectItem>
                        <SelectItem value="is_empty">Is empty</SelectItem>
                        <SelectItem value="is_not_empty">Is not empty</SelectItem>
                      </SelectContent>
                    </Select>
                    {filter.operator !== 'is_empty' && filter.operator !== 'is_not_empty' && (
                      <Input
                        value={filter.value}
                        onChange={(e) => handleFilterChange(idx, 'value', e.target.value)}
                        placeholder="Value..."
                        className="flex-1"
                      />
                    )}
                    <Button
                      onClick={() => handleRemoveFilter(idx)}
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            
            <div className="flex gap-2">
              <Button
                onClick={handleLoadFilteredEmployees}
                disabled={getFilteredEmployees().length === 0}
                className="flex-1"
              >
                <Users className="w-4 h-4 mr-2" />
                Load All Matching ({getFilteredEmployees().length})
              </Button>
              <Button
                onClick={handleRemoveFilteredEmployees}
                variant="destructive"
                disabled={employees.length === 0 || getFilteredEmployees().length === 0}
                className="flex-1"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Remove Matching
              </Button>
            </div>
          </Card>
        )}

        {employees.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-2 text-gray-400" />
            <p>No employees added. Click "Add Employee" or upload a CSV file.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {employees.map((emp, idx) => (
              <Card key={idx} className="p-4 border border-gray-200">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div>
                      <Label>Employee ID</Label>
                      <Input
                        value={emp.id}
                        onChange={(e) => {
                          const updated = [...employees];
                          updated[idx].id = e.target.value;
                          setEmployees(updated);
                        }}
                        className="mt-1"
                      />
                    </div>
                    {Object.entries(requiredInputs).map(([key, meta]) => (
                      <div key={key}>
                        <Label>{meta.label || meta.name}</Label>
                        {meta.type === 'select' && meta.options ? (
                          <Select
                            value={String(emp.inputs[key] || '')}
                            onValueChange={(value) => handleEmployeeInputChange(idx, key, value === '__empty__' ? '' : value)}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder={`Select ${meta.label}`} />
                            </SelectTrigger>
                            <SelectContent>
                              {meta.options.map((opt) => (
                                <SelectItem key={opt} value={opt === '' ? '__empty__' : opt}>
                                  {opt === '' ? '(Empty)' : opt}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : meta.type === 'boolean' ? (
                          <div className="flex items-center gap-2 mt-2">
                            <Switch
                              checked={emp.inputs[key] === true || emp.inputs[key] === 1 || String(emp.inputs[key]).toLowerCase() === "true"}
                              onCheckedChange={(checked) => handleEmployeeInputChange(idx, key, checked)}
                            />
                            <Label className="text-sm text-gray-600 cursor-pointer">
                              {(emp.inputs[key] === true || emp.inputs[key] === 1 || String(emp.inputs[key]).toLowerCase() === "true") ? "True" : "False"}
                            </Label>
                          </div>
                        ) : (
                          <Input
                            type={meta.type === 'number' ? 'number' : 'text'}
                            value={emp.inputs[key] || ''}
                            onChange={(e) => {
                              const value = meta.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
                              handleEmployeeInputChange(idx, key, value);
                            }}
                            min={meta.min}
                            className="mt-1"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col gap-2 ml-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSaveEmployee(idx)}
                      title="Save employee data for later use"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveEmployee(idx)}
                      title="Remove employee"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>

      {hasData && simulationResult && (
        <div ref={resultsRef}>
          {/* Summary Card */}
          <Card className="p-6 bg-white rounded-xl shadow-sm border-0 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-[#0052CC] bg-opacity-10 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-[#0052CC]" />
                </div>
                <div>
                  <div className="text-sm text-gray-600">Total Employees</div>
                  <div className="text-2xl text-[#1E1E1E]">{employeeResults.length}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-600">Total Payroll Cost</div>
                <div className="text-2xl text-[#0052CC]">{formatCurrency(Number(simulationResult.grandTotal))}</div>
                {comparisonMode && baselineResult && (
                  <>
                    <div className="text-xs text-gray-500 mt-1">
                      Baseline: {formatCurrency(Number(baselineResult.grandTotal))}
                    </div>
                    <div className={`text-sm font-semibold mt-1 ${
                      Number(simulationResult.grandTotal) >= Number(baselineResult.grandTotal)
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}>
                      {Number(simulationResult.grandTotal) >= Number(baselineResult.grandTotal) ? '+' : ''}
                      {formatCurrency(Number(simulationResult.grandTotal) - Number(baselineResult.grandTotal))}
                    </div>
                  </>
                )}
              </div>
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Export Results
              </Button>
            </div>
          </Card>

          {/* Charts */}
          {componentData.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Aggregated Components Chart */}
              <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
                <h3 className="text-[#1E1E1E] mb-4">
                  Aggregated Totals by Component
                  {comparisonMode && baselineResult && <span className="text-sm text-gray-500 ml-2">(vs Baseline)</span>}
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={componentDataWithComparison}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" height={100} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip 
                      formatter={(value: number, name: string, props: any) => {
                        if (name === 'amount') {
                          return formatCurrency(value);
                        }
                        if (name === 'baselineAmount') {
                          return `Baseline: ${formatCurrency(value)}`;
                        }
                        if (name === 'delta') {
                          return `Δ: ${formatCurrency(value)}`;
                        }
                        return value;
                      }}
                    />
                    {comparisonMode && baselineResult && (
                      <Bar dataKey="baselineAmount" fill="#94A3B8" radius={[8, 8, 0, 0]} name="Baseline" />
                    )}
                    <Bar dataKey="amount" fill="#0052CC" radius={[8, 8, 0, 0]} name="Current" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              {/* Top Components */}
              <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
                <h3 className="text-[#1E1E1E] mb-4">
                  Top Components by Cost
                  {comparisonMode && baselineResult && <span className="text-sm text-gray-500 ml-2">(vs Baseline)</span>}
                </h3>
                <div className="space-y-3">
                  {componentDataWithComparison.slice(0, 10).map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className="w-8 text-sm text-gray-500">{idx + 1}</div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-sm text-[#1E1E1E]">{item.name}</div>
                          {comparisonMode && baselineResult && item.delta !== null && (
                            <div className={`text-xs font-semibold ${
                              item.delta >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {item.delta >= 0 ? '+' : ''}{formatCurrency(item.delta)}
                            </div>
                          )}
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden relative">
                          {comparisonMode && baselineResult && item.baselineAmount !== null && (
                            <div
                              className="h-full bg-gray-400 absolute"
                              style={{ width: `${(item.baselineAmount / (componentDataWithComparison[0]?.amount || 1)) * 100}%` }}
                            />
                          )}
                          <div
                            className={`h-full ${comparisonMode && baselineResult ? 'bg-[#0052CC]' : 'bg-[#0052CC]'} relative`}
                            style={{ width: `${(item.amount / (componentDataWithComparison[0]?.amount || 1)) * 100}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-sm text-[#1E1E1E] min-w-[100px] text-right">
                        <div>{formatCurrency(item.amount)}</div>
                        {comparisonMode && baselineResult && item.baselineAmount !== null && (
                          <div className="text-xs text-gray-500">
                            was {formatCurrency(item.baselineAmount)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {/* Employee Table */}
          <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
            <h3 className="text-[#1E1E1E] mb-4">
              Employee Results
              {comparisonMode && baselineResult && <span className="text-sm text-gray-500 ml-2">(vs Baseline)</span>}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm text-gray-600">Employee ID</th>
                    <th className="text-right py-3 px-4 text-sm text-gray-600">Total Compensation</th>
                    {comparisonMode && baselineResult && (
                      <>
                        <th className="text-right py-3 px-4 text-sm text-gray-600">Baseline</th>
                        <th className="text-right py-3 px-4 text-sm text-gray-600">Difference</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {employeeResults.map((emp) => (
                    <tr 
                      key={emp.id} 
                      className="border-b border-gray-100 hover:bg-[#EEF2F8] transition-colors cursor-pointer"
                      onClick={() => setSelectedEmployee(emp)}
                    >
                      <td className="py-3 px-4 text-sm text-[#1E1E1E]">{emp.id}</td>
                      <td className="py-3 px-4 text-sm text-[#1E1E1E] text-right font-semibold">
                        {formatCurrency(emp.total)}
                      </td>
                      {comparisonMode && baselineResult && (
                        <>
                          <td className="py-3 px-4 text-sm text-gray-600 text-right">
                            {emp.baselineTotal !== null ? formatCurrency(emp.baselineTotal) : 'N/A'}
                          </td>
                          <td className="py-3 px-4 text-sm text-right">
                            {emp.delta !== null && (
                              <span className={`font-semibold ${
                                emp.delta >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {emp.delta >= 0 ? '+' : ''}{formatCurrency(emp.delta)}
                              </span>
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {!hasData && employees.length === 0 && (
        <Card className="p-12 bg-white rounded-xl shadow-sm border-0">
          <div className="text-center">
            <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-[#1E1E1E] mb-2">No Data Loaded</h3>
            <p className="text-gray-600 mb-6">
              Add employees manually or upload a CSV file to run a bulk simulation
            </p>
          </div>
        </Card>
      )}

      {/* Employee Breakdown Dialog */}
      <Dialog open={selectedEmployee !== null} onOpenChange={(open) => !open && setSelectedEmployee(null)}>
        <DialogContent 
          className="max-w-4xl flex flex-col p-0 overflow-hidden !top-[2rem] !translate-y-0"
          style={{
            left: '50%',
            transform: 'translateX(-50%)',
            maxHeight: 'calc(100vh - 4rem)',
            height: 'auto',
            position: 'fixed',
            margin: 0
          } as React.CSSProperties}
        >
          <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-gray-200">
            <DialogTitle className="text-[#1E1E1E]">
              Component Breakdown - {selectedEmployee?.id}
            </DialogTitle>
          </DialogHeader>
          {selectedEmployee && (
            <div className="space-y-6 flex-1 min-h-0 overflow-y-auto px-6 pb-6 pt-4">
              {/* Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4 bg-white border border-gray-200">
                  <div className="text-sm text-gray-600">Current Total</div>
                  <div className="text-2xl font-semibold text-[#1E1E1E]">
                    {formatCurrency(selectedEmployee.total)}
                  </div>
                </Card>
                {comparisonMode && baselineResult && selectedEmployee.baselineTotal !== null && (
                  <>
                    <Card className="p-4 bg-white border border-gray-200">
                      <div className="text-sm text-gray-600">Baseline Total</div>
                      <div className="text-2xl font-semibold text-gray-600">
                        {formatCurrency(selectedEmployee.baselineTotal)}
                      </div>
                    </Card>
                    <Card className="p-4 bg-white border border-gray-200">
                      <div className="text-sm text-gray-600">Difference</div>
                      <div className={`text-2xl font-semibold ${
                        selectedEmployee.delta >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {selectedEmployee.delta >= 0 ? '+' : ''}{formatCurrency(selectedEmployee.delta)}
                      </div>
                    </Card>
                  </>
                )}
              </div>

              {/* Component Breakdown Table */}
              <div>
                <h4 className="text-[#1E1E1E] mb-3 font-semibold">Components</h4>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-3 text-sm text-gray-600">Component</th>
                        <th className="text-right py-2 px-3 text-sm text-gray-600">Current</th>
                        {comparisonMode && baselineResult && (
                          <>
                            <th className="text-right py-2 px-3 text-sm text-gray-600">Baseline</th>
                            <th className="text-right py-2 px-3 text-sm text-gray-600">Difference</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(selectedEmployee.components || {})
                        .sort(([, a], [, b]) => Number(b) - Number(a))
                        .map(([component, amount]) => {
                          const currentAmount = Number(amount);
                          const baselineAmount = comparisonMode && baselineResult 
                            ? Number(selectedEmployee.baselineComponents[component] || 0)
                            : null;
                          const delta = baselineAmount !== null ? currentAmount - baselineAmount : null;
                          
                          return (
                            <tr key={component} className="border-b border-gray-100">
                              <td className="py-2 px-3 text-sm text-[#1E1E1E]">{component}</td>
                              <td className="py-2 px-3 text-sm text-[#1E1E1E] text-right font-semibold">
                                {formatCurrency(currentAmount)}
                              </td>
                              {comparisonMode && baselineResult && (
                                <>
                                  <td className="py-2 px-3 text-sm text-gray-600 text-right">
                                    {baselineAmount !== null ? formatCurrency(baselineAmount) : '-'}
                                  </td>
                                  <td className="py-2 px-3 text-sm text-right">
                                    {delta !== null && (
                                      <span className={`font-semibold ${
                                        delta >= 0 ? 'text-green-600' : 'text-red-600'
                                      }`}>
                                        {delta >= 0 ? '+' : ''}{formatCurrency(delta)}
                                      </span>
                                    )}
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
