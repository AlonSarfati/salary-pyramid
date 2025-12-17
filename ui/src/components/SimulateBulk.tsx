import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Play, Download, Users, Loader2, Plus, Trash2, X, ChevronLeft, ChevronRight, Edit2 } from 'lucide-react';
import { Card } from './ui/card';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { Button } from './ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { rulesetApi, simulationApi, employeeApi, type EmployeeInput, type SimBulkResponse, type Employee, type RuleSet } from '../services/apiService';
import { useToast } from "./ToastProvider";
import { StateScreen } from "./ui/StateScreen";
import { useCurrency } from '../hooks/useCurrency';
import { formatCurrency as formatCurrencyUtil } from '../utils/currency';
import * as XLSX from 'xlsx';

export default function SimulateBulk({ tenantId = "default" }: { tenantId?: string }) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const currency = useCurrency(tenantId);
  const [hasData, setHasData] = useState(false);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simulationError, setSimulationError] = useState<{ type: 'network' | 'system'; message?: string; supportRef?: string } | null>(null);

  // Ruleset state
  const [rulesets, setRulesets] = useState<Array<{ rulesetId: string; name: string; count: number }>>([]);
  const [selectedRulesetId, setSelectedRulesetId] = useState<string | null>(null);
  const [rulesLoading, setRulesLoading] = useState(false);
  
  // Global ruleset persistence key
  const GLOBAL_RULESET_KEY = `globalRuleset_${tenantId}`;

  // Clear selected ruleset when tenant changes
  useEffect(() => {
    setSelectedRulesetId(null);
    setSimulationResult(null);
    setBaselineResult(null);
  setRulesetDetails(null);
  setEmployerComponentsMap({});
  }, [tenantId]);

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
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  
  // Bulk edit dialog state
  const [showBulkEditDialog, setShowBulkEditDialog] = useState(false);
  const [bulkEditColumn, setBulkEditColumn] = useState<{ key: string; meta: { name: string; label: string; type: string; defaultValue: any; options?: string[]; min?: number } } | null>(null);
  const [bulkEditValue, setBulkEditValue] = useState<any>('');
  
  // Results state
  const [simulationResult, setSimulationResult] = useState<SimBulkResponse | null>(null);
  const [baselineResult, setBaselineResult] = useState<SimBulkResponse | null>(null);
  const [baselineRulesetId, setBaselineRulesetId] = useState<string | null>(null);
  const [baselinePayMonth, setBaselinePayMonth] = useState<string>('');
  const [rulesetDetails, setRulesetDetails] = useState<RuleSet | null>(null);
  const [employerComponentsMap, setEmployerComponentsMap] = useState<Record<string, boolean>>({});
  
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
                } else {
                  // Stored ruleset doesn't exist in current tenant, clear it
                  localStorage.removeItem(GLOBAL_RULESET_KEY);
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

  // Fetch full ruleset details for employer cost classification
  useEffect(() => {
    if (!selectedRulesetId) {
      setRulesetDetails(null);
      setEmployerComponentsMap({});
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const rs = await rulesetApi.getRuleset(tenantId, selectedRulesetId);
        if (cancelled) return;
        setRulesetDetails(rs);
        const map: Record<string, boolean> = {};
        rs.rules.forEach(rule => {
          const layer = rule.meta?.layer;
          if (layer && layer.toLowerCase() === 'employer') {
            map[rule.target] = true;
          }
        });
        setEmployerComponentsMap(map);
      } catch (e) {
        console.error('Failed to load ruleset details for bulk simulation view:', e);
        if (!cancelled) {
          setRulesetDetails(null);
          setEmployerComponentsMap({});
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tenantId, selectedRulesetId]);

  // Fetch required inputs when ruleset changes
  useEffect(() => {
    if (!selectedRulesetId) {
      setRequiredInputs({});
      return;
    }
    
    let cancelled = false;
    (async () => {
      try {
        setInputsLoading(true);
        const payDay = payMonth ? `${payMonth}-01` : new Date().toISOString().slice(0, 10);
        const response = await fetch(
          `/api/simulate/required-inputs?tenantId=${tenantId}&rulesetId=${selectedRulesetId}&payDay=${payDay}`
        );
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || 'Failed to fetch required inputs');
        }
        const inputs = await response.json();
        if (!cancelled) {
          setRequiredInputs(inputs);
        }
      } catch (e: any) {
        // Check if this is a "Ruleset not found" error (happens when switching tenants)
        // Error can be wrapped as "API call failed: 404 - Ruleset not found: ..." or direct
        const errorMsg = e.message || '';
        const isRulesetNotFound = errorMsg.includes('Ruleset not found') || 
                                  errorMsg.includes('NoSuchElementException') ||
                                  (e.response?.status === 404) ||
                                  (errorMsg.includes('404') && errorMsg.includes('Ruleset'));
        
        if (isRulesetNotFound && !cancelled) {
          // Clear the selected ruleset and reload rulesets list instead of showing error
          setSelectedRulesetId(null);
          setRequiredInputs({});
          // Reload rulesets to get the correct list for this tenant
          try {
            const data = await rulesetApi.getActive(tenantId);
            if (!cancelled) {
              setRulesets(data.ruleSets || []);
              if (data.ruleSets && data.ruleSets.length > 0) {
                setSelectedRulesetId(data.ruleSets[0].rulesetId);
              }
            }
          } catch (reloadErr) {
            console.error('Failed to reload rulesets:', reloadErr);
          }
        } else {
          console.error('Failed to load required inputs:', e);
          if (!cancelled) {
            setRequiredInputs({});
          }
        }
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
        // Small event - use toast
        showToast("error", "Couldn't load employees", "Please try again.");
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
      showToast("info", "Enter Employee ID", "Please enter an Employee ID before saving.");
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
      showToast("error", "Couldn't save employee", "Please try again.");
      console.error('Failed to save employee:', e);
    }
  };

  const handleRemoveEmployee = (index: number) => {
    const updated = employees.filter((_, i) => i !== index);
    setEmployees(updated);
    // Reset to page 1 if current page becomes empty
    const totalPages = Math.ceil(updated.length / itemsPerPage);
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    } else if (updated.length === 0) {
      setCurrentPage(1);
    }
  };
  
  // Pagination calculations
  const totalPages = Math.ceil(employees.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedEmployees = employees.slice(startIndex, endIndex);
  
  // Reset to page 1 when employees list changes significantly
  useEffect(() => {
    const newTotalPages = Math.ceil(employees.length / itemsPerPage);
    if (currentPage > newTotalPages && newTotalPages > 0) {
      setCurrentPage(newTotalPages);
    } else if (employees.length > 0 && currentPage < 1) {
      setCurrentPage(1);
    }
  }, [employees.length, currentPage, itemsPerPage]);

  const handleEmployeeInputChange = (index: number, inputName: string, value: any) => {
    const updated = [...employees];
    updated[index].inputs[inputName] = value;
    setEmployees(updated);
  };
  
  const handleBulkColumnEdit = (inputKey: string, value: any) => {
    const updated = employees.map(emp => ({
      ...emp,
      inputs: {
        ...emp.inputs,
        [inputKey]: value
      }
    }));
    setEmployees(updated);
    showToast("success", "Column Updated", `Updated ${updated.length} employee(s) in this column.`);
  };
  
  const handleOpenBulkEditDialog = (key: string) => {
    const meta = requiredInputs[key];
    setBulkEditColumn({ key, meta });
    setBulkEditValue(meta.defaultValue || '');
    setShowBulkEditDialog(true);
  };
  
  const handleConfirmBulkEdit = () => {
    if (!bulkEditColumn) return;
    
    const value = bulkEditColumn.meta.type === 'number' 
      ? parseFloat(bulkEditValue) || 0 
      : bulkEditValue;
    
    handleBulkColumnEdit(bulkEditColumn.key, value);
    setShowBulkEditDialog(false);
    setBulkEditColumn(null);
    setBulkEditValue('');
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
      showToast("info", "Add employees", "Please add at least one employee before running a simulation.");
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
      // Check if this is a "Ruleset not found" error (happens when switching tenants)
      const isRulesetNotFound = e.message?.includes('Ruleset not found') || 
                                e.message?.includes('NoSuchElementException') ||
                                (e.response?.status === 404);
      
      if (isRulesetNotFound) {
        // Clear the selected ruleset and reload rulesets list instead of showing error
        setSelectedRulesetId(null);
        setSimulationResult(null);
        setBaselineResult(null);
        // Reload rulesets to get the correct list for this tenant
        try {
          const data = await rulesetApi.getActive(tenantId);
          setRulesets(data.ruleSets || []);
          if (data.ruleSets && data.ruleSets.length > 0) {
            setSelectedRulesetId(data.ruleSets[0].rulesetId);
            showToast("info", "Ruleset not found", "The selected ruleset is not available in this tenant. Please select a different ruleset.");
          } else {
            showToast("info", "No rulesets", "This tenant has no rulesets. Please create a ruleset first.");
          }
        } catch (reloadErr) {
          console.error('Failed to reload rulesets:', reloadErr);
          showToast("error", "Error", "Failed to reload rulesets. Please refresh the page.");
        }
        return;
      }
      
      const isNetworkError = e.message?.includes('fetch') || e.message?.includes('network') || e.message?.includes('Failed to fetch');
      setSimulationError({
        type: isNetworkError ? 'network' : 'system',
        message: e.message,
        supportRef: e.response?.status ? `HTTP-${e.response.status}` : undefined,
      });
      console.error('Simulation error:', e);
      console.error('Simulation error:', e);
    } finally {
      setSimulating(false);
    }
  };

  const handleSetBaseline = () => {
    if (!simulationResult) {
      showToast("info", "No baseline available", "Run a simulation first, then set it as baseline.");
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

  const handleExportResults = (format: 'xlsx' | 'csv' = 'xlsx') => {
    if (!simulationResult) {
      showToast("info", "No data to export", "Please run a simulation first.");
      return;
    }

    try {
      // Prepare employee results for export (same logic as employeeResults but computed here)
      const exportEmployeeResults = simulationResult.results.map((r) => {
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
      });

      if (exportEmployeeResults.length === 0) {
        showToast("error", "No data to export", "No employee results available.");
        return;
      }

      // Get all unique component names from all employees
      const allComponentNames = new Set<string>();
      exportEmployeeResults.forEach(emp => {
        Object.keys(emp.components || {}).forEach(comp => allComponentNames.add(comp));
      });
      const sortedComponents = Array.from(allComponentNames).sort();

      // Build header row
      const headers: string[] = ['Employee ID', 'Total Compensation'];
      if (comparisonMode && baselineResult) {
        headers.push('Baseline Total', 'Difference');
      }
      sortedComponents.forEach(comp => {
        headers.push(comp);
        if (comparisonMode && baselineResult) {
          headers.push(`${comp} (Baseline)`, `${comp} (Diff)`);
        }
      });

      // Build data rows
      const rows: any[][] = [headers];
      exportEmployeeResults.forEach(emp => {
        const row: any[] = [
          emp.id,
          emp.total
        ];
        
        if (comparisonMode && baselineResult) {
          row.push(emp.baselineTotal !== null ? emp.baselineTotal : 0);
          row.push(emp.delta !== null ? emp.delta : 0);
        }

        sortedComponents.forEach(comp => {
          const currentAmount = Number(emp.components[comp] || 0);
          row.push(currentAmount);
          
          if (comparisonMode && baselineResult) {
            const baselineAmount = Number(emp.baselineComponents[comp] || 0);
            const diff = currentAmount - baselineAmount;
            row.push(baselineAmount);
            row.push(diff);
          }
        });

        rows.push(row);
      });

      // Generate filename
      const rulesetName = rulesets.find(r => r.rulesetId === selectedRulesetId)?.name || 'simulation';
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const filename = `simulation_results_${rulesetName}_${dateStr}`;

      if (format === 'xlsx') {
        // Create workbook and worksheet
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(rows);
        
        // Set column widths
        const colWidths = headers.map((_, idx) => {
          const maxLength = Math.max(
            headers[idx].length,
            ...rows.slice(1).map(r => String(r[idx] || '').length)
          );
          return { wch: Math.min(Math.max(maxLength + 2, 10), 50) };
        });
        ws['!cols'] = colWidths;
        
        XLSX.utils.book_append_sheet(wb, ws, 'Results');
        XLSX.writeFile(wb, `${filename}.xlsx`);
        showToast("success", "Export Successful", "Results exported to Excel successfully.");
      } else {
        // CSV format
        const csvContent = rows.map(row => 
          row.map(cell => {
            const str = String(cell || '');
            // Escape quotes and wrap in quotes if contains comma, quote, or newline
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          }).join(',')
        ).join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${filename}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast("success", "Export Successful", "Results exported to CSV successfully.");
      }
    } catch (error: any) {
      console.error('Export error:', error);
      showToast("error", "Export failed", "Please try again.");
    }
  };

  // Prepare chart data from results, with employer cost awareness
  const {
    componentData,
    employerTotalAggregated,
    salaryTotalAggregated,
  } = useMemo(() => {
    if (!simulationResult) {
      return {
        componentData: [] as Array<{ name: string; amount: number }>,
        employerTotalAggregated: 0,
        salaryTotalAggregated: 0,
      };
    }

    const entries = Object.entries(simulationResult.totalsByComponent).map(([name, amount]) => ({
      name,
      amount: Number(amount),
    }));

    const employerTotal = entries
      .filter(entry => employerComponentsMap[entry.name])
      .reduce((sum, entry) => sum + entry.amount, 0);

    const salaryTotal = Number(simulationResult.grandTotal) - employerTotal;

    return {
      componentData: entries.sort((a, b) => b.amount - a.amount),
      employerTotalAggregated: employerTotal,
      salaryTotalAggregated: salaryTotal,
    };
  }, [simulationResult, employerComponentsMap]);

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

  // Show empty state if no rulesets (but not an error - API call succeeded)
  if (!rulesLoading && rulesets.length === 0) {
    return (
      <div className="p-8 max-w-[1600px] mx-auto">
        <h1 className="text-[#1E1E1E] mb-6">Bulk / Segment Simulation</h1>
        <StateScreen
          type="empty"
          title="No rulesets"
          description="Create your first ruleset to start running bulk salary simulations for multiple employees."
          primaryActionLabel="Create Ruleset"
          onPrimaryAction={() => navigate('/rules/builder')}
        />
      </div>
    );
  }

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
        <div className="mb-4">
          <StateScreen
            type={simulationError.type}
            supportRef={simulationError.supportRef}
            onPrimaryAction={() => {
              setSimulationError(null);
              handleRun();
            }}
            inline
          />
        </div>
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
          <StateScreen
            type="empty"
            title="No employees"
            description="Add employees to run bulk simulations. You can add them manually or import from a CSV or Excel file."
            primaryActionLabel="Go to Employees"
            onPrimaryAction={() => window.location.href = '/employees'}
            inline
          />
        ) : (
          <>
            <div className="overflow-x-auto -mx-6 px-6" style={{ width: '100%' }}>
              <Table className="min-w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-white z-10 min-w-[120px]">Employee ID</TableHead>
                    {Object.keys(requiredInputs).map(key => {
                      const meta = requiredInputs[key];
                      return (
                        <TableHead key={key} className="min-w-[120px] whitespace-nowrap">
                          <div className="flex items-center justify-between gap-2">
                            <span>{meta.label || meta.name}</span>
                            {meta.type === 'boolean' ? (
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-xs"
                                  onClick={() => handleBulkColumnEdit(key, true)}
                                  title="Set all to True"
                                >
                                  T
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-xs"
                                  onClick={() => handleBulkColumnEdit(key, false)}
                                  title="Set all to False"
                                >
                                  F
                                </Button>
                              </div>
                            ) : meta.type === 'select' && meta.options ? (
                              <Select
                                onValueChange={(value) => handleBulkColumnEdit(key, value === '__empty__' ? '' : value)}
                              >
                                <SelectTrigger className="h-6 w-20 text-xs">
                                  <Edit2 className="w-3 h-3" />
                                </SelectTrigger>
                                <SelectContent>
                                  {meta.options.map((opt) => (
                                    <SelectItem key={opt} value={opt === '' ? '__empty__' : opt}>
                                      {opt === '' ? '(Empty)' : opt}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={() => handleOpenBulkEditDialog(key)}
                                title="Edit all values in this column"
                              >
                                <Edit2 className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </TableHead>
                      );
                    })}
                    <TableHead className="text-right min-w-[140px] sticky right-0 bg-white z-10">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedEmployees.map((emp, localIdx) => {
                    const globalIdx = startIndex + localIdx;
                    return (
                      <TableRow key={globalIdx}>
                        <TableCell className="font-medium sticky left-0 bg-white z-10">
                          <div className="w-full px-3 py-2 bg-gray-50 text-gray-700 rounded border border-gray-200">
                            {emp.id}
                          </div>
                        </TableCell>
                        {Object.keys(requiredInputs).map(key => {
                          const meta = requiredInputs[key];
                          return (
                            <TableCell key={key} className="whitespace-nowrap">
                              {meta.type === 'select' && meta.options ? (
                                <Select
                                  value={String(emp.inputs[key] || '')}
                                  onValueChange={(value) => handleEmployeeInputChange(globalIdx, key, value === '__empty__' ? '' : value)}
                                >
                                  <SelectTrigger className="w-full">
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
                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={emp.inputs[key] === true || emp.inputs[key] === 1 || String(emp.inputs[key]).toLowerCase() === "true"}
                                    onCheckedChange={(checked) => handleEmployeeInputChange(globalIdx, key, checked)}
                                  />
                                  <span className="text-sm text-gray-600">
                                    {(emp.inputs[key] === true || emp.inputs[key] === 1 || String(emp.inputs[key]).toLowerCase() === "true") ? "True" : "False"}
                                  </span>
                                </div>
                              ) : (
                                <Input
                                  type={meta.type === 'number' ? 'number' : 'text'}
                                  value={emp.inputs[key] || ''}
                                  onChange={(e) => {
                                    const value = meta.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
                                    handleEmployeeInputChange(globalIdx, key, value);
                                  }}
                                  min={meta.min}
                                  className="w-full"
                                />
                              )}
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-right sticky right-0 bg-white z-10">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveEmployee(globalIdx)}
                              title="Remove employee"
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="text-sm text-gray-600">
                  Showing {startIndex + 1} to {Math.min(endIndex, employees.length)} of {employees.length} employees
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </Button>
                  <div className="text-sm text-gray-600">
                    Page {currentPage} of {totalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Bulk Edit Dialog */}
      <Dialog open={showBulkEditDialog} onOpenChange={setShowBulkEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk Edit Column</DialogTitle>
          </DialogHeader>
          {bulkEditColumn && (
            <div className="space-y-4 py-4">
              <div>
                <Label>{bulkEditColumn.meta.label || bulkEditColumn.meta.name}</Label>
                {bulkEditColumn.meta.type === 'number' ? (
                  <Input
                    type="number"
                    value={bulkEditValue}
                    onChange={(e) => setBulkEditValue(parseFloat(e.target.value) || 0)}
                    min={bulkEditColumn.meta.min}
                    className="mt-2"
                    placeholder="Enter value"
                  />
                ) : (
                  <Input
                    type="text"
                    value={bulkEditValue}
                    onChange={(e) => setBulkEditValue(e.target.value)}
                    className="mt-2"
                    placeholder="Enter value"
                  />
                )}
                <p className="text-sm text-gray-500 mt-2">
                  This will update all {employees.length} employee(s) in this column.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmBulkEdit}>
              Apply to All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              <div className="text-right space-y-1">
                <div className="text-sm text-gray-600">Total Employer + Employee Cost</div>
                <div className="text-2xl text-[#0052CC]">{formatCurrency(Number(simulationResult.grandTotal))}</div>
                <div className="text-sm text-gray-600 pt-1 border-t border-gray-200">
                  Employee Compensation: {formatCurrency(salaryTotalAggregated)}
                </div>
                {employerTotalAggregated > 0 && (
                  <div className="text-sm text-gray-600">
                    Employer Cost: {formatCurrency(employerTotalAggregated)}
                  </div>
                )}
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
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline"
                  onClick={() => handleExportResults('xlsx')}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export to Excel
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => handleExportResults('csv')}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export to CSV
                </Button>
              </div>
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
