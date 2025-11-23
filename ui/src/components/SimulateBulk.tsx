import React, { useState, useEffect } from 'react';
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

export default function SimulateBulk({ tenantId = "default" }: { tenantId?: string }) {
  const [hasData, setHasData] = useState(false);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simulationError, setSimulationError] = useState<string | null>(null);

  // Ruleset state
  const [rulesets, setRulesets] = useState<Array<{ rulesetId: string; name: string; count: number }>>([]);
  const [selectedRulesetId, setSelectedRulesetId] = useState<string | null>(null);
  const [rulesLoading, setRulesLoading] = useState(false);

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

  // Results state
  const [simulationResult, setSimulationResult] = useState<SimBulkResponse | null>(null);
  const [baselineResult, setBaselineResult] = useState<SimBulkResponse | null>(null);
  const [baselineRulesetId, setBaselineRulesetId] = useState<string | null>(null);
  const [baselinePayMonth, setBaselinePayMonth] = useState<string>('');

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
            setSelectedRulesetId(data.ruleSets[0].rulesetId);
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

  const handleSaveEmployee = async (index: number) => {
    const emp = employees[index];
    if (!emp.id || emp.id.trim() === '') {
      alert('Please enter an Employee ID before saving');
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
      alert('Employee saved successfully!');
    } catch (e: any) {
      alert('Failed to save employee: ' + (e.message || 'Unknown error'));
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
      alert('Please add at least one employee');
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
      } else {
        setSimulationResult(result);
        setHasData(true);
      }
    } catch (e: any) {
      setSimulationError(e.message || 'Failed to run simulation');
      console.error('Simulation error:', e);
    } finally {
      setSimulating(false);
    }
  };

  const handleSetBaseline = () => {
    if (!simulationResult) {
      alert('Please run a simulation first to set as baseline');
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
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
              onValueChange={(value) => setSelectedRulesetId(value || null)}
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
            )}
            <Button onClick={handleAddEmployee} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Employee
            </Button>
          </div>
        </div>

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
                          <Select
                            value={String(emp.inputs[key] || false)}
                            onValueChange={(value) => handleEmployeeInputChange(idx, key, value === 'true')}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="true">Yes</SelectItem>
                              <SelectItem value="false">No</SelectItem>
                            </SelectContent>
                          </Select>
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
        <>
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
        </>
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#1E1E1E]">
              Component Breakdown - {selectedEmployee?.id}
            </DialogTitle>
          </DialogHeader>
          {selectedEmployee && (
            <div className="space-y-6">
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
