import React, { useEffect, useMemo, useState, useRef } from "react";
import { Play, Save, Info, User, Users, Loader2 } from "lucide-react";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import SimulateBulk from "./SimulateBulk";
import { rulesetApi, simulationApi, employeeApi, scenarioApi, type EmployeeInput, type SimEmployeeResponse, type Employee } from "../services/apiService";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { useCurrency } from '../hooks/useCurrency';
import { formatCurrencyWithDecimals, getCurrencySymbol } from '../utils/currency';

export default function SimulateSingle({ tenantId = "default" }: { tenantId?: string }) {
  // Get currency for tenant
  const currency = useCurrency(tenantId);
  
  // ---- states ----
  const [showTrace, setShowTrace] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState<string>("");
  const [simulating, setSimulating] = useState(false);
  const [simulationError, setSimulationError] = useState<string | null>(null);

  // Ruleset state
  const [rulesets, setRulesets] = useState<Array<{ rulesetId: string; name: string; count: number }>>([]);
  const [selectedRulesetId, setSelectedRulesetId] = useState<string | null>(null);
  const [selectedRulesetName, setSelectedRulesetName] = useState<string>("");
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rulesError, setRulesError] = useState<string>("");

  // Form state
  const [employeeId, setEmployeeId] = useState("E001");
  const [payMonth, setPayMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM format
  
  // Dynamic input state - will be populated from required inputs API
  const [requiredInputs, setRequiredInputs] = useState<Record<string, { name: string; label: string; type: string; defaultValue: any; options?: string[]; min?: number }>>({});
  const [inputValues, setInputValues] = useState<Record<string, any>>({});
  const [inputsLoading, setInputsLoading] = useState(false);

  // Results state
  const [simulationResult, setSimulationResult] = useState<SimEmployeeResponse | null>(null);

  // Saved employees state
  const [savedEmployees, setSavedEmployees] = useState<Employee[]>([]);
  const [savedEmployeesLoading, setSavedEmployeesLoading] = useState(false);
  
  // Track last auto-filled employee to avoid overwriting user edits
  const lastAutoFilledEmployeeId = useRef<string | null>(null);

  // Save scenario state
  const [showSaveScenarioDialog, setShowSaveScenarioDialog] = useState(false);
  const [scenarioName, setScenarioName] = useState("");
  const [savingScenario, setSavingScenario] = useState(false);

  // ---- check for rerun scenario data on mount ----
  useEffect(() => {
    const rerunData = localStorage.getItem('rerunScenario');
    if (rerunData) {
      try {
        const scenario = JSON.parse(rerunData);
        if (scenario.rulesetId) {
          setSelectedRulesetId(scenario.rulesetId);
        }
        if (scenario.payMonth) {
          setPayMonth(scenario.payMonth);
        }
        if (scenario.inputData) {
          setInputValues(scenario.inputData);
        }
        // Clear the rerun data after loading
        localStorage.removeItem('rerunScenario');
      } catch (e) {
        console.error('Failed to parse rerun scenario data:', e);
        localStorage.removeItem('rerunScenario');
      }
    }
  }, []);

  // ---- fetch rulesets ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setRulesLoading(true);
        setRulesError("");
        const data = await rulesetApi.getActive(tenantId);
        if (!cancelled) {
          setRulesets(data.ruleSets || []);
          if (data.ruleSets && data.ruleSets.length > 0) {
            // If we have a selected ruleset from rerun, find its name
            if (selectedRulesetId) {
              const selected = data.ruleSets.find(rs => rs.rulesetId === selectedRulesetId);
              if (selected) {
                setSelectedRulesetName(selected.name || selected.rulesetId);
              }
            } else {
              // Otherwise, set default to first ruleset
              setSelectedRulesetId(data.ruleSets[0].rulesetId);
              setSelectedRulesetName(data.ruleSets[0].name || data.ruleSets[0].rulesetId);
            }
          }
        }
      } catch (e: any) {
        if (!cancelled) setRulesError(e.message || "Failed to load rulesets");
      } finally {
        if (!cancelled) setRulesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  // ---- fetch required inputs when ruleset changes ----
  useEffect(() => {
    if (!selectedRulesetId) {
      setRequiredInputs({});
      setInputValues({});
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setInputsLoading(true);
        // Convert month (YYYY-MM) to first day of month for API
        const payDay = payMonth ? `${payMonth}-01` : new Date().toISOString().split('T')[0];
        const inputs = await simulationApi.getRequiredInputs(tenantId, selectedRulesetId, payDay);
        if (!cancelled) {
          setRequiredInputs(inputs);
          
          // Preserve existing input values, only set defaults for new fields
          setInputValues(prevValues => {
            const newValues: Record<string, any> = { ...prevValues };
            // For each required input, preserve existing value or use default
            for (const [name, metadata] of Object.entries(inputs)) {
              // Only set default if this field doesn't exist in previous values
              // or if the field structure changed (e.g., new field added)
              if (newValues[name] === undefined) {
                newValues[name] = metadata.defaultValue;
              }
              // If field was removed from required inputs, we keep it in newValues
              // (it will just be ignored by the API)
            }
            return newValues;
          });
        }
      } catch (e: any) {
        console.error("Failed to load required inputs:", e);
        // On error, use empty inputs
        if (!cancelled) {
          setRequiredInputs({});
          setInputValues({});
        }
      } finally {
        if (!cancelled) setInputsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId, selectedRulesetId, payMonth]);

  // ---- fetch saved employees ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setSavedEmployeesLoading(true);
        const employees = await employeeApi.list(tenantId);
        if (!cancelled) {
          setSavedEmployees(employees);
        }
      } catch (e: any) {
        console.error('Failed to load saved employees:', e);
      } finally {
        if (!cancelled) setSavedEmployeesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tenantId]);

  // ---- normalize for the Select UI ----
  const rulesetOptions = useMemo(() => {
    return rulesets.map(rs => ({
      value: rs.rulesetId,
      label: `${rs.name || rs.rulesetId} (${rs.count} rules)`
    }));
  }, [rulesets]);

  // Helper function to populate form with employee data
  const populateFormWithEmployee = (employee: Employee) => {
    if (!employee.data || Object.keys(requiredInputs).length === 0) return;
    
    const newInputValues: Record<string, any> = {};
    Object.entries(requiredInputs).forEach(([key, meta]) => {
      // Use employee data if available, otherwise use default
      newInputValues[key] = employee.data[key] !== undefined 
        ? employee.data[key] 
        : meta.defaultValue;
    });
    setInputValues(newInputValues);
  };

  // ---- auto-fill employee data when both savedEmployees and requiredInputs are ready ----
  useEffect(() => {
    if (savedEmployees.length === 0 || !employeeId || Object.keys(requiredInputs).length === 0 || inputsLoading) return;
    
    const selectedEmployee = savedEmployees.find(emp => emp.employeeId === employeeId);
    if (selectedEmployee && selectedEmployee.data) {
      // Only auto-fill if we haven't already auto-filled this employee, or if employeeId changed
      const shouldAutoFill = lastAutoFilledEmployeeId.current !== employeeId;
      
      if (shouldAutoFill) {
        populateFormWithEmployee(selectedEmployee);
        lastAutoFilledEmployeeId.current = employeeId;
      }
    }
  }, [savedEmployees, employeeId, requiredInputs, inputsLoading]); // Only depend on these, not inputValues to avoid loops

  // ---- handle employee selection ----
  const handleEmployeeSelect = (selectedEmployeeId: string) => {
    setEmployeeId(selectedEmployeeId);
    lastAutoFilledEmployeeId.current = null; // Reset so auto-fill can run
    
    // Find the selected employee and populate form with their data
    const selectedEmployee = savedEmployees.find(emp => emp.employeeId === selectedEmployeeId);
    if (selectedEmployee) {
      // Always populate when user explicitly selects an employee
      populateFormWithEmployee(selectedEmployee);
      lastAutoFilledEmployeeId.current = selectedEmployeeId;
    }
  };

  // ---- handle save scenario ----
  const handleSaveScenario = async () => {
    if (!scenarioName.trim()) {
      alert("Please enter a scenario name");
      return;
    }
    if (!selectedRulesetId) {
      alert("Please select a ruleset");
      return;
    }
    if (!simulationResult) {
      alert("Please run a simulation first");
      return;
    }

    try {
      setSavingScenario(true);
      await scenarioApi.create({
        tenantId,
        name: scenarioName.trim(),
        rulesetId: selectedRulesetId,
        payMonth,
        inputData: inputValues,
        resultData: {
          components: simulationResult.components,
          total: simulationResult.total.toString(),
        },
        simulationType: 'single',
      });
      setShowSaveScenarioDialog(false);
      setScenarioName("");
      alert("Scenario saved successfully!");
    } catch (e: any) {
      console.error("Failed to save scenario:", e);
      alert("Failed to save scenario: " + (e.message || "Unknown error"));
    } finally {
      setSavingScenario(false);
    }
  };

  // ---- handle simulation ----
  const handleRun = async () => {
    if (!selectedRulesetId) {
      setSimulationError("Please select a ruleset");
      return;
    }

    try {
      setSimulating(true);
      setSimulationError(null);

      // Build employee input from dynamic input values
      // Map known fields to their EmployeeInput properties, everything else goes to extra
      const knownFields = {
        BaseSalary: "base",
        Hours: "hours",
        Rate: "rate",
        Sales: "sales",
        PerformanceRating: "performance",
        YearsOfService: "yearsOfService",
        HasFamily: "hasFamily",
        IsManager: "isManager",
        Department: "department",
        Status: "status",
      };
      
      const employeeInput: any = {
        id: employeeId,
      };
      
      const extra: Record<string, any> = {};
      
      // Map all input values
      for (const [key, value] of Object.entries(inputValues)) {
        const mappedKey = knownFields[key as keyof typeof knownFields];
        if (mappedKey) {
          employeeInput[mappedKey] = value;
        } else {
          // Unknown fields go to extra
          extra[key] = value;
        }
      }
      
      if (Object.keys(extra).length > 0) {
        employeeInput.extra = extra;
      }

      const result = await simulationApi.simulateEmployee({
        tenantId,
        rulesetId: selectedRulesetId,
        payDay: payMonth ? `${payMonth}-01` : new Date().toISOString().split('T')[0],
        employee: employeeInput,
      });

      setSimulationResult(result);
    } catch (err: any) {
      setSimulationError(err.message || "Simulation failed");
      setSimulationResult(null);
    } finally {
      setSimulating(false);
    }
  };

  const handleShowTrace = (component: string) => {
    setSelectedComponent(component);
    setShowTrace(true);
  };

  // Calculate results for display
  const results = useMemo(() => {
    if (!simulationResult) return [];

    const components = simulationResult.components;
    const total = simulationResult.total;

    return Object.entries(components).map(([component, amount]) => ({
      component,
      expression: "", // Would need to fetch from ruleset
      amount: amount,
      contribution: total > 0 ? (amount / total) * 100 : 0,
    }));
  }, [simulationResult]);

  const totalAmount = simulationResult?.total || 0;

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <h1 className="text-[#1E1E1E] mb-6">Simulate</h1>

      {simulationError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {simulationError}
        </div>
      )}

      <Tabs defaultValue="single" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="single" className="flex items-center gap-2">
            <User className="w-4 h-4" />
            Single Employee
          </TabsTrigger>
          <TabsTrigger value="bulk" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Bulk / Segment
          </TabsTrigger>
        </TabsList>

        <TabsContent value="single">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[#1E1E1E]">Single Employee Simulation</h2>
            <button 
              onClick={() => setShowSaveScenarioDialog(true)}
              disabled={!simulationResult}
              className="flex items-center gap-2 px-6 py-3 bg-white text-[#0052CC] border border-[#0052CC] rounded-xl hover:bg-[#EEF2F8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-5 h-5" />
              Save Scenario
            </button>
          </div>

          {/* Macro Controls - Ruleset and Pay Month - Centered above simulation */}
          <div className="mb-6 flex items-center justify-center">
            <Card className="p-4 bg-white rounded-xl shadow-sm border-0">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                  <Label htmlFor="ruleset-top" className="text-sm font-medium text-gray-700">Ruleset:</Label>
                  {rulesLoading ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Loading...</span>
                    </div>
                  ) : rulesetOptions.length === 0 ? (
                    <div className="text-sm text-gray-500">No rulesets available</div>
                  ) : (
                    <Select
                      value={selectedRulesetId || ''}
                      onValueChange={(value) => {
                        setSelectedRulesetId(value);
                        const selected = rulesets.find(rs => rs.rulesetId === value);
                        setSelectedRulesetName(selected?.name || value);
                      }}
                    >
                      <SelectTrigger id="ruleset-top" className="w-[300px]">
                        <SelectValue placeholder="Select ruleset..." />
                      </SelectTrigger>
                      <SelectContent>
                        {rulesetOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                
                <div className="h-8 w-px bg-gray-300"></div>
                
                <div className="flex items-center gap-3">
                  <Label htmlFor="payMonth-top" className="text-sm font-medium text-gray-700">Pay Month:</Label>
                  <Input
                    id="payMonth-top"
                    type="month"
                    value={payMonth}
                    onChange={(e) => setPayMonth(e.target.value)}
                    className="w-[180px]"
                  />
                </div>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Panel - Input Form */}
            <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
              <h3 className="text-[#1E1E1E] mb-6">Input Parameters</h3>

              {inputsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-[#0052CC]" />
                  <span className="ml-2 text-gray-600">Loading required inputs...</span>
                </div>
              ) : Object.keys(requiredInputs).length === 0 ? (
                <div className="text-gray-500 text-sm py-4">
                  {selectedRulesetId 
                    ? "No input parameters required for this ruleset."
                    : "Please select a ruleset to see required inputs."}
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="employee">Employee</Label>
                    {savedEmployeesLoading ? (
                      <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Loading employees...</span>
                      </div>
                    ) : (
                      <>
                        <Select value={employeeId} onValueChange={handleEmployeeSelect}>
                          <SelectTrigger id="employee" className="mt-1">
                            <SelectValue placeholder="Select employee or enter ID..." />
                          </SelectTrigger>
                          <SelectContent>
                            {savedEmployees.length > 0 ? (
                              savedEmployees.map((emp) => (
                                <SelectItem key={emp.employeeId} value={emp.employeeId}>
                                  {emp.employeeId} - {emp.name || '(No name)'}
                                </SelectItem>
                              ))
                            ) : (
                              <SelectItem value="__none__" disabled>
                                No saved employees. Go to Employees tab to add some.
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        <Input
                          value={employeeId}
                          onChange={(e) => setEmployeeId(e.target.value)}
                          placeholder="Or enter employee ID manually"
                          className="mt-2"
                        />
                        {savedEmployees.length > 0 && (
                          <p className="text-xs text-gray-500 mt-1">
                            Select an employee to auto-fill their data, or enter a new ID
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  {/* Dynamically render input fields based on required inputs */}
                  {Object.entries(requiredInputs).map(([name, metadata]) => {
                    const value = inputValues[name] ?? metadata.defaultValue;
                    return (
                      <div key={name}>
                        <Label htmlFor={name}>{metadata.label}</Label>
                        {metadata.type === "select" && metadata.options ? (
                          <Select
                            value={value === "" ? "__empty__" : String(value)}
                            onValueChange={(v) => {
                              // Convert __empty__ back to empty string
                              const actualValue = v === "__empty__" ? "" : v;
                              setInputValues({ ...inputValues, [name]: actualValue });
                            }}
                          >
                            <SelectTrigger id={name} className="mt-1">
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                              {metadata.options.map((option) => {
                                // Use __empty__ as the value for empty strings
                                const selectValue = option === "" ? "__empty__" : option;
                                return (
                                  <SelectItem key={selectValue} value={selectValue}>
                                    {option === "" ? "(empty)" : option}
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        ) : metadata.type === "boolean" ? (
                          <Select
                            value={String(value)}
                            onValueChange={(v) =>
                              setInputValues({ ...inputValues, [name]: v === "1" ? 1 : 0 })
                            }
                          >
                            <SelectTrigger id={name} className="mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">Yes</SelectItem>
                              <SelectItem value="0">No</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : metadata.type === "string" ? (
                          <Input
                            id={name}
                            type="text"
                            value={String(value)}
                            onChange={(e) =>
                              setInputValues({ ...inputValues, [name]: e.target.value })
                            }
                            placeholder={String(metadata.defaultValue)}
                            className="mt-1"
                          />
                        ) : (
                          <Input
                            id={name}
                            type="number"
                            min={metadata.min !== undefined ? metadata.min : undefined}
                            value={value}
                            onFocus={(e) => {
                              // Select all text when focused, so typing replaces the value
                              e.target.select();
                            }}
                            onKeyDown={(e) => {
                              // If value is 0 and user presses a digit, clear the input first
                              if (value === 0 && /^[0-9]$/.test(e.key)) {
                                e.currentTarget.value = '';
                              }
                            }}
                            onChange={(e) => {
                              const newValue = e.target.value;
                              setInputValues({ ...inputValues, [name]: Number(newValue) || 0 });
                            }}
                            placeholder={String(metadata.defaultValue)}
                            className="mt-1"
                          />
                        )}
                      </div>
                    );
                  })}

                  <button
                    onClick={handleRun}
                    disabled={simulating || !selectedRulesetId}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#0052CC] text-white rounded-xl hover:bg-[#0047b3] transition-colors mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {simulating ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Running...
                      </>
                    ) : (
                      <>
                        <Play className="w-5 h-5" />
                        Run Simulation
                      </>
                    )}
                  </button>
                </div>
              )}
            </Card>

            {/* Right Panel - Results */}
            <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
              <h3 className="text-[#1E1E1E] mb-6">Results</h3>

              {!simulationResult ? (
                <div className="flex items-center justify-center h-64 text-gray-500">
                  Run a simulation to see results
                </div>
              ) : (
                <>
                  <div className="space-y-2 mb-6">
                    {/* Table Header */}
                    <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-[#EEF2F8] rounded-lg text-sm text-gray-600">
                      <div className="col-span-6">Component</div>
                      <div className="col-span-3 text-right">Amount</div>
                      <div className="col-span-2 text-right">Contrib %</div>
                      <div className="col-span-1"></div>
                    </div>

                    {/* Table Rows */}
                    {results.map((result, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-12 gap-4 px-4 py-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="col-span-6 text-[#1E1E1E]">{result.component}</div>
                        <div className="col-span-3 text-right text-[#1E1E1E]">
                          {formatCurrencyWithDecimals(result.amount, currency, 2)}
                        </div>
                        <div className="col-span-2 text-right text-gray-600">
                          {result.contribution.toFixed(1)}%
                        </div>
                        <div className="col-span-1 flex justify-end">
                          <button
                            onClick={() => handleShowTrace(result.component)}
                            className="p-1 hover:bg-gray-200 rounded"
                          >
                            <Info className="w-4 h-4 text-[#0052CC]" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Total Card */}
                  <Card className="p-4 bg-[#0052CC] text-white rounded-xl border-0 shadow-md">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm opacity-90">Total Compensation</div>
                        <div className="text-2xl mt-1">
                          {formatCurrencyWithDecimals(totalAmount, currency, 2)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm opacity-90">Pay Month</div>
                        <div className="mt-1">
                          {payMonth ? new Date(payMonth + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : 'N/A'}
                        </div>
                      </div>
                    </div>
                  </Card>
                </>
              )}
            </Card>
          </div>

          {/* Trace Drawer */}
          <Sheet open={showTrace} onOpenChange={setShowTrace}>
            <SheetContent className="w-[400px] sm:w-[540px]">
              <SheetHeader>
                <SheetTitle>Calculation Trace: {selectedComponent}</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                {simulationResult && (
                  <Card className="p-4 bg-[#EEF2F8] border-0">
                    <div className="text-[#1E1E1E] mb-2">{selectedComponent}</div>
                    <div className="text-sm text-gray-600 font-mono">
                      Amount: {formatCurrencyWithDecimals(simulationResult.components[selectedComponent] || 0, currency, 2)}
                    </div>
                    <div className="text-[#0052CC] mt-2">
                      Component calculation details would appear here
                    </div>
                  </Card>
                )}
              </div>
            </SheetContent>
          </Sheet>

          {/* Save Scenario Dialog */}
          <Dialog open={showSaveScenarioDialog} onOpenChange={setShowSaveScenarioDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Save Scenario</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="scenario-name">Scenario Name</Label>
                  <Input
                    id="scenario-name"
                    value={scenarioName}
                    onChange={(e) => setScenarioName(e.target.value)}
                    placeholder="e.g., Q4 2024 - Engineering"
                    className="mt-1"
                  />
                </div>
                {simulationResult && (
                  <div className="p-4 bg-[#EEF2F8] rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Total: {formatCurrencyWithDecimals(simulationResult.total, currency, 2)}</div>
                    <div className="text-sm text-gray-600">Ruleset: {selectedRulesetName || selectedRulesetId}</div>
                    <div className="text-sm text-gray-600">Pay Month: {payMonth}</div>
                  </div>
                )}
              </div>
              <DialogFooter className="mt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowSaveScenarioDialog(false);
                    setScenarioName("");
                  }}
                  disabled={savingScenario}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveScenario}
                  disabled={savingScenario || !scenarioName.trim()}
                >
                  {savingScenario ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="bulk">
          <SimulateBulk />
        </TabsContent>
      </Tabs>
    </div>
  );
}
