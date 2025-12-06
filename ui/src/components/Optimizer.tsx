import { useState, useEffect } from 'react';
import { TrendingUp, Play, Save, Loader2, AlertCircle, CheckCircle2, DollarSign, Users, Percent, Info } from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { optimizerApi, rulesetApi, scenarioApi, tableApi, componentGroupsApi, employeeApi, type OptimizationResult, type OptimizeRequest, type ComponentGroup, type FocusDefinition } from '../services/apiService';
import { useToast } from './ToastProvider';
import { useCurrency } from '../hooks/useCurrency';
import { formatCurrencyWithDecimals, getCurrencySymbol, parseFormattedNumber, formatNumberCompact } from '../utils/currency';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';

interface OptimizerProps {
  tenantId?: string;
}

export default function Optimizer({ tenantId = 'default' }: OptimizerProps) {
  const { showToast } = useToast();
  const currency = useCurrency(tenantId);
  
  // Ruleset selection
  const [rulesets, setRulesets] = useState<Array<{ rulesetId: string; name: string; status: string }>>([]);
  const [selectedRulesetId, setSelectedRulesetId] = useState<string | null>(null);
  const [rulesetsLoading, setRulesetsLoading] = useState(false);
  
  // Form state
  const [extraBudget, setExtraBudget] = useState<string>('');
  const [strategy, setStrategy] = useState<string>('FLAT_RAISE_ON_BASE');
  // Target component will be initialized from the selected ruleset's components
  const [targetComponent, setTargetComponent] = useState<string>('');
  const [targetGroup, setTargetGroup] = useState<string>('');
  const [newComponentName, setNewComponentName] = useState<string>('');
  const [targetTable, setTargetTable] = useState<string>('');
  const [tableComponent, setTableComponent] = useState<string>('');
  // Focus configuration (for segmented strategies) - support multiple conditions (AND)
  type UiFocusCondition = {
    field: string;
    type: 'number' | 'string';
    values: string[];
    min?: string;
    max?: string;
  };
  const [focusConditions, setFocusConditions] = useState<UiFocusCondition[]>([]);
  const [focusPriority, setFocusPriority] = useState<'SLIGHT' | 'STRONG' | 'EXTREME'>('STRONG');
  
  // Optimization state
  const [optimizing, setOptimizing] = useState(false);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Save scenario state
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [scenarioName, setScenarioName] = useState('');
  const [savingScenario, setSavingScenario] = useState(false);
  
  // Available components (will be populated from ruleset)
  const [availableComponents, setAvailableComponents] = useState<string[]>([]);
  // Available focus fields derived from employees
  const [availableFocusFields, setAvailableFocusFields] = useState<Array<{
    name: string;
    type: 'number' | 'string';
    values: string[]; // for string fields
    min?: number;
    max?: number;
  }>>([]);
  
  // Component groups and tables
  const [componentGroups, setComponentGroups] = useState<ComponentGroup[]>([]);
  const [availableTables, setAvailableTables] = useState<Array<{ tableName: string; component: string }>>([]);
  
  // Group name to number mapping
  const groupNameToNumber = (): Map<string, string> => {
    const mapping = new Map<string, string>();
    componentGroups
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .forEach((group, index) => {
        const groupNumber = `group${index + 1}`;
        mapping.set(group.groupName.toLowerCase(), groupNumber);
      });
    return mapping;
  };
  
  // Load component groups
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const groups = await componentGroupsApi.getAll();
        if (!cancelled) {
          setComponentGroups(groups);
          // Set default target group to first group
          if (groups.length > 0) {
            const firstGroup = groups.sort((a, b) => a.displayOrder - b.displayOrder)[0];
            const groupNum = `group${firstGroup.displayOrder}`;
            setTargetGroup(groupNum);
          }
        }
      } catch (e: any) {
        console.error('Failed to load component groups:', e);
      }
    })();
    return () => { cancelled = true; };
  }, []);
  
  // Load tables when component is selected for table strategy
  useEffect(() => {
    if (strategy === 'INCREASE_TABLE_VALUES' && tableComponent) {
      let cancelled = false;
      (async () => {
        try {
          const response = await tableApi.listTables(tenantId, tableComponent);
          if (!cancelled) {
            const tables = (response.tables || []).map(t => ({
              tableName: t.tableName,
              component: tableComponent,
            }));
            setAvailableTables(tables);
            if (tables.length > 0 && !targetTable) {
              setTargetTable(tables[0].tableName);
            }
          }
        } catch (e: any) {
          console.error('Failed to load tables:', e);
          setAvailableTables([]);
        }
      })();
      return () => { cancelled = true; };
    } else {
      setAvailableTables([]);
    }
  }, [strategy, tableComponent, tenantId]);

  // Load focus fields from employees (dynamic: detect numeric vs string + distinct values / ranges)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const employees = await employeeApi.list(tenantId);
        if (cancelled) return;

        const fieldMeta = new Map<string, {
          type: 'number' | 'string';
          values: Set<string>;
          min?: number;
          max?: number;
        }>();

        for (const emp of employees) {
          const data = emp.data || {};
          for (const [key, rawVal] of Object.entries<any>(data)) {
            if (rawVal === null || rawVal === undefined) continue;
            const meta =
              fieldMeta.get(key) ||
              ({ type: 'string', values: new Set<string>(), min: undefined, max: undefined } as {
                type: 'number' | 'string';
                values: Set<string>;
                min?: number;
                max?: number;
              });

            const str = String(rawVal).trim();
            const isNumeric = str !== '' && !Number.isNaN(Number(str));

            if (isNumeric) {
              const num = Number(str);
              if (meta.values.size === 0 || meta.type === 'number') {
                meta.type = 'number';
                meta.min = meta.min !== undefined ? Math.min(meta.min, num) : num;
                meta.max = meta.max !== undefined ? Math.max(meta.max, num) : num;
              }
            } else if (str !== '') {
              meta.type = 'string';
              meta.values.add(str);
            }
            fieldMeta.set(key, meta);
          }
        }

        const focusFields: Array<{
          name: string;
          type: 'number' | 'string';
          values: string[];
          min?: number;
          max?: number;
        }> = [];

        for (const [name, meta] of fieldMeta.entries()) {
          if (!name) continue;
          if (meta.type === 'number') {
            focusFields.push({
              name,
              type: 'number',
              values: [],
              min: meta.min,
              max: meta.max,
            });
          } else {
            const values = Array.from(meta.values)
              .filter((v) => v !== '')
              .sort((a, b) => a.localeCompare(b));
            if (values.length > 0) {
              focusFields.push({
                name,
                type: 'string',
                values,
              });
            }
          }
        }

        // Sort fields alphabetically for nicer UX
        focusFields.sort((a, b) => a.name.localeCompare(b.name));
        setAvailableFocusFields(focusFields);
      } catch (e) {
        console.error('Failed to load employees for focus options:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);
  
  // Load rulesets
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setRulesetsLoading(true);
        const data = await rulesetApi.getActive(tenantId);
        if (!cancelled) {
          setRulesets(data.ruleSets || []);
          if (data.ruleSets && data.ruleSets.length > 0) {
            const first = data.ruleSets[0];
            setSelectedRulesetId(first.rulesetId);
          }
        }
      } catch (e: any) {
        if (!cancelled) {
          console.error('Failed to load rulesets:', e);
        }
      } finally {
        if (!cancelled) {
          setRulesetsLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [tenantId]);
  
  // Load components from selected ruleset
  useEffect(() => {
    if (!selectedRulesetId) return;
    
    let cancelled = false;
    (async () => {
      try {
        const ruleset = await rulesetApi.getRuleset(tenantId, selectedRulesetId);
        if (!cancelled && ruleset.rules) {
          const components = ruleset.rules.map(r => r.target).filter(Boolean);
          setAvailableComponents(components);
          // Set default target component if current one is not available
          if (components.length > 0 && !components.includes(targetComponent)) {
            setTargetComponent(components[0]);
          }
        }
      } catch (e: any) {
        console.error('Failed to load ruleset:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedRulesetId, tenantId]);
  
  const handleOptimize = async () => {
    if (!selectedRulesetId) {
      setError('Please select a ruleset');
      return;
    }
    
    // Parse the budget - supports formatted input like "50M", "1.3M", "500K"
    const budgetValue = parseFormattedNumber(extraBudget);
    if (budgetValue === null || budgetValue <= 0) {
      setError('Please enter a valid positive budget amount (e.g., 50M, 1.3M, 500K)');
      return;
    }
    
    // Validate strategy-specific fields
    if (strategy === 'ADD_NEW_COMPONENT_IN_GROUP' && !targetGroup) {
      setError('Please select a target group');
      return;
    }
    if (
      (strategy === 'FLAT_RAISE_ON_BASE' || strategy === 'SEGMENTED_FLAT_RAISE') &&
      (!targetComponent || !availableComponents.includes(targetComponent))
    ) {
      setError('Please select a valid target component');
      return;
    }
    if (strategy === 'INCREASE_TABLE_VALUES') {
      if (!tableComponent) {
        setError('Please select a component that owns the table');
        return;
      }
      if (!targetTable) {
        setError('Please select a table');
        return;
      }
    }
    
    setOptimizing(true);
    setError(null);
    setResult(null);
    
    try {
      // Convert group number to group name if needed
      let finalTargetGroup = targetGroup;
      if (strategy === 'ADD_NEW_COMPONENT_IN_GROUP' && targetGroup.startsWith('group')) {
        const groupNum = parseInt(targetGroup.replace('group', ''));
        const group = componentGroups.find(g => g.displayOrder === groupNum);
        if (group) {
          finalTargetGroup = group.groupName;
        }
      }
      
      // Map focus priority to numeric weight
      const mapPriorityToWeight = (p: typeof focusPriority): number => {
        switch (p) {
          case 'SLIGHT':
            return 1.5;
          case 'EXTREME':
            return 3.0;
          case 'STRONG':
          default:
            return 2.0;
        }
      };

      const focusConditionsPayload =
        strategy === 'SEGMENTED_FLAT_RAISE'
          ? focusConditions
              .map((c) => {
                const meta = availableFocusFields.find((f) => f.name === c.field);
                if (!c.field || !meta) return undefined;
                if (meta.type === 'number') {
                  const min = c.min && c.min !== '' ? Number(c.min) : undefined;
                  const max = c.max && c.max !== '' ? Number(c.max) : undefined;
                  if (min === undefined && max === undefined) return undefined;
                  return {
                    field: c.field,
                    fieldType: 'number' as const,
                    min,
                    max,
                  };
                }
                // string field
                if (!c.values || c.values.length === 0) return undefined;
                return {
                  field: c.field,
                  fieldType: 'string' as const,
                  values: c.values,
                };
              })
              .filter((c): c is FocusDefinition['conditions'][number] => !!c)
          : [];

      const focus: FocusDefinition | undefined =
        strategy === 'SEGMENTED_FLAT_RAISE' && focusConditionsPayload.length > 0
          ? {
              conditions: focusConditionsPayload,
              weight: mapPriorityToWeight(focusPriority),
            }
          : undefined;

      const request: OptimizeRequest = {
        tenantId,
        rulesetId: selectedRulesetId,
        extraBudget: budgetValue,
        strategy,
        targetComponent:
          strategy === 'FLAT_RAISE_ON_BASE' || strategy === 'SEGMENTED_FLAT_RAISE'
            ? targetComponent
            : undefined,
        targetGroup: strategy === 'ADD_NEW_COMPONENT_IN_GROUP' ? finalTargetGroup : undefined,
        newComponentName: strategy === 'ADD_NEW_COMPONENT_IN_GROUP' ? (newComponentName || undefined) : undefined,
        targetTable: strategy === 'INCREASE_TABLE_VALUES' ? targetTable : undefined,
        tableComponent: strategy === 'INCREASE_TABLE_VALUES' ? tableComponent : undefined,
        focus,
      };
      
      const optimizationResult = await optimizerApi.optimize(request);
      setResult(optimizationResult);
      showToast('Optimization completed successfully', 'success');
    } catch (e: any) {
      const errorMessage = e.message || 'Failed to run optimization';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setOptimizing(false);
    }
  };
  
  const handleSaveAsScenario = async () => {
    if (!result || !scenarioName.trim()) {
      showToast('Please enter a scenario name', 'error');
      return;
    }
    
    setSavingScenario(true);
    try {
      const payMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
      
      // Ensure all data is properly structured
      const adjustmentPlan = result.adjustmentPlan || result.raisePlan;
      const inputData = {
        optimizer: true,
        extraBudget: result.extraBudget || '0',
        strategy: result.strategy || 'FLAT_RAISE_ON_BASE',
        raisePlan: adjustmentPlan || {
          strategy: result.strategy || 'FLAT_RAISE_ON_BASE',
          targetComponent: adjustmentPlan?.targetComponent || 'Base',
          percentage: adjustmentPlan?.percentage || '0',
          description: adjustmentPlan?.description || '',
        },
      };
      
      // Calculate total for display in Results page (use optimized total)
      const optimizedTotal = parseFloat(result.optimized?.totalCost || '0');
      
      const resultData = {
        // Include total and components for Results page compatibility
        total: optimizedTotal.toString(),
        components: result.optimized?.componentTotals || {},
        // Optimization-specific data
        baseline: result.baseline || {
          totalCost: '0',
          avgPerEmployee: '0',
          employeeCount: 0,
          componentTotals: {},
        },
        optimized: result.optimized || {
          totalCost: '0',
          avgPerEmployee: '0',
          employeeCount: 0,
          componentTotals: {},
        },
        extraCostUsed: result.extraCostUsed || '0',
        raisePlan: result.adjustmentPlan || result.raisePlan || {
          strategy: result.strategy || 'FLAT_RAISE_ON_BASE',
          targetComponent: (result.adjustmentPlan || result.raisePlan)?.targetComponent || 'Base',
          percentage: (result.adjustmentPlan || result.raisePlan)?.percentage || '0',
          description: (result.adjustmentPlan || result.raisePlan)?.description || '',
        },
        rulesetId: result.rulesetId,
        rulesetName: result.rulesetName,
        asOfDate: result.asOfDate,
        // Mark as optimization scenario
        optimization: true,
      };
      
      await scenarioApi.create({
        tenantId,
        name: scenarioName,
        rulesetId: result.rulesetId,
        payMonth,
        inputData,
        resultData,
        simulationType: 'optimization',
      });
      
      showToast('Scenario saved successfully', 'success');
      setShowSaveDialog(false);
      setScenarioName('');
    } catch (e: any) {
      console.error('Failed to save scenario:', e);
      const errorMessage = e.message || 'Failed to save scenario';
      showToast(errorMessage, 'error');
    } finally {
      setSavingScenario(false);
    }
  };
  
  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return formatCurrencyWithDecimals(num, currency);
  };
  
  const formatPercent = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return `${num.toFixed(2)}%`;
  };
  
  const selectedRuleset = rulesets.find(r => r.rulesetId === selectedRulesetId);
  
  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#1E1E1E] mb-2">Raise Optimizer</h1>
        <p className="text-gray-600">
          Plan raises based on an extra yearly budget. Choose a ruleset and budget, and we'll calculate a flat raise percentage.
        </p>
      </div>
      
      {/* Controls Card */}
      <Card className="p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {/* Ruleset Selector */}
          <div>
            <Label htmlFor="ruleset">Ruleset</Label>
            <Select
              value={selectedRulesetId || ''}
              onValueChange={(value) => {
                setSelectedRulesetId(value);
                setResult(null);
              }}
              disabled={rulesetsLoading}
            >
              <SelectTrigger id="ruleset">
                <SelectValue placeholder="Select ruleset" />
              </SelectTrigger>
              <SelectContent>
                {rulesets.map((rs) => (
                  <SelectItem key={rs.rulesetId} value={rs.rulesetId}>
                    {rs.name || rs.rulesetId} {rs.status === 'ACTIVE' && '(Active)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Extra Budget Input */}
          <div>
            <Label htmlFor="budget">Extra Yearly Budget</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 z-10">
                {getCurrencySymbol(currency)}
              </span>
              <Input
                id="budget"
                type="text"
                value={extraBudget}
                onChange={(e) => setExtraBudget(e.target.value)}
                placeholder="50M or 1.3M or 500K"
                className="pl-8"
              />
            </div>
            {extraBudget && (() => {
              const parsed = parseFormattedNumber(extraBudget);
              return parsed !== null && parsed > 0 ? (
                <p className="text-xs text-gray-500 mt-1">
                  = {formatCurrencyWithDecimals(parsed, currency)}
                </p>
              ) : extraBudget.trim() !== '' ? (
                <p className="text-xs text-red-500 mt-1">
                  Invalid format. Use numbers like 50M, 1.3M, or 500K
                </p>
              ) : null;
            })()}
          </div>
          
          {/* Strategy Selector */}
          <div>
            <Label htmlFor="strategy">Strategy</Label>
            <Select value={strategy} onValueChange={(value) => {
              setStrategy(value);
              setResult(null);
            }}>
              <SelectTrigger id="strategy">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FLAT_RAISE_ON_BASE">Flat raise on component</SelectItem>
                <SelectItem value="SEGMENTED_FLAT_RAISE">Segmented raise with focus group</SelectItem>
                <SelectItem value="ADD_NEW_COMPONENT_IN_GROUP">Add new component in group</SelectItem>
                <SelectItem value="INCREASE_TABLE_VALUES">Increase table values from current month</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Target component (used for FLAT_RAISE_ON_BASE and SEGMENTED_FLAT_RAISE) */}
          {(strategy === 'FLAT_RAISE_ON_BASE' || strategy === 'SEGMENTED_FLAT_RAISE') && (
            <div>
              <Label htmlFor="component">Target Component</Label>
              <Select
                value={targetComponent}
                onValueChange={setTargetComponent}
                disabled={availableComponents.length === 0}
              >
                <SelectTrigger id="component">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableComponents.map((comp) => (
                    <SelectItem key={comp} value={comp}>
                      {comp}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          {strategy === 'ADD_NEW_COMPONENT_IN_GROUP' && (
            <>
              <div>
                <Label htmlFor="targetGroup">Target Group</Label>
                <Select
                  value={targetGroup}
                  onValueChange={setTargetGroup}
                  disabled={componentGroups.length === 0}
                >
                  <SelectTrigger id="targetGroup">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {componentGroups
                      .sort((a, b) => a.displayOrder - b.displayOrder)
                      .map((group) => {
                        const groupNum = `group${group.displayOrder}`;
                        return (
                          <SelectItem key={group.groupName} value={groupNum}>
                            {group.displayName || group.groupName} ({groupNum})
                          </SelectItem>
                        );
                      })}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="newComponentName">New Component Name (optional)</Label>
                <Input
                  id="newComponentName"
                  value={newComponentName}
                  onChange={(e) => setNewComponentName(e.target.value)}
                  placeholder="Auto-generated if empty"
                />
              </div>
            </>
          )}
          
          {strategy === 'INCREASE_TABLE_VALUES' && (
            <>
              <div>
                <Label htmlFor="tableComponent">Component</Label>
                <Select
                  value={tableComponent}
                  onValueChange={(value) => {
                    setTableComponent(value);
                    setTargetTable(''); // Reset table selection
                  }}
                  disabled={availableComponents.length === 0}
                >
                  <SelectTrigger id="tableComponent">
                    <SelectValue placeholder="Select component" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableComponents.map((comp) => (
                      <SelectItem key={comp} value={comp}>
                        {comp}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="targetTable">Table</Label>
                <Select
                  value={targetTable}
                  onValueChange={setTargetTable}
                  disabled={!tableComponent || availableTables.length === 0}
                >
                  <SelectTrigger id="targetTable">
                    <SelectValue placeholder="Select table" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTables.map((t) => (
                      <SelectItem key={t.tableName} value={t.tableName}>
                        {t.tableName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Focus configuration - only for segmented strategies (future extension) */}
          {strategy === 'SEGMENTED_FLAT_RAISE' && (
            <div className="md:col-span-2 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="mb-0">Focus (optional)</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Add a new empty focus condition
                    setFocusConditions((conds) => [
                      ...conds,
                      { field: '', type: 'string', values: [], min: '', max: '' },
                    ]);
                  }}
                >
                  Add condition
                </Button>
              </div>

              {focusConditions.length === 0 && (
                <p className="text-xs text-gray-500">
                  Optionally add one or more conditions. Employees must match all conditions to be in the focus group.
                </p>
              )}

              <div className="space-y-3">
                {focusConditions.map((cond, idx) => {
                  const meta = availableFocusFields.find((f) => f.name === cond.field);
                  const type: 'number' | 'string' = meta?.type ?? cond.type;
                  return (
                    <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                      {/* Field selector */}
                      <div>
                        <Label>Field</Label>
                        <Select
                          value={cond.field || ''}
                          onValueChange={(value) => {
                            setFocusConditions((conds) =>
                              conds.map((c, i) =>
                                i === idx
                                  ? {
                                      field: value,
                                      type: availableFocusFields.find((f) => f.name === value)?.type ?? 'string',
                                      values: [],
                                      min: '',
                                      max: '',
                                    }
                                  : c,
                              ),
                            );
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select field" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableFocusFields
                              .filter((f) => f.name && f.name !== '')
                              .map((f) => (
                                <SelectItem key={f.name} value={f.name}>
                                  {f.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Values or range */}
                      <div>
                        <Label>Condition</Label>
                        {!meta && (
                          <p className="text-xs text-gray-500 mt-1">
                            Select a field to configure this focus condition.
                          </p>
                        )}
                        {meta && type === 'number' && (
                          <div className="flex gap-2">
                            <Input
                              type="number"
                              placeholder={meta.min != null ? String(meta.min) : 'Min'}
                              value={cond.min ?? ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setFocusConditions((conds) =>
                                  conds.map((c, i) => (i === idx ? { ...c, min: val } : c)),
                                );
                              }}
                            />
                            <Input
                              type="number"
                              placeholder={meta.max != null ? String(meta.max) : 'Max'}
                              value={cond.max ?? ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setFocusConditions((conds) =>
                                  conds.map((c, i) => (i === idx ? { ...c, max: val } : c)),
                                );
                              }}
                            />
                          </div>
                        )}
                        {meta && type === 'string' && (
                          <Select
                            value={cond.values[0] || ''}
                            onValueChange={(value) => {
                              setFocusConditions((conds) =>
                                conds.map((c, i) => (i === idx ? { ...c, values: [value] } : c)),
                              );
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select value" />
                            </SelectTrigger>
                            <SelectContent>
                              {meta.values
                                .filter((v) => v !== '')
                                .map((v) => (
                                  <SelectItem key={v} value={v}>
                                    {v}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>

                      {/* Remove button */}
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setFocusConditions((conds) => conds.filter((_, i) => i !== idx));
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Priority / intensity (applies to full focus group) */}
              <div>
                <Label htmlFor="focusPriority">Focus intensity</Label>
                <Select
                  value={focusPriority}
                  onValueChange={(value) => setFocusPriority(value as typeof focusPriority)}
                >
                  <SelectTrigger id="focusPriority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SLIGHT">Slight priority</SelectItem>
                    <SelectItem value="STRONG">Strong priority</SelectItem>
                    <SelectItem value="EXTREME">Extreme priority</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  Controls how much more aggressively the focus group is raised compared to others.
                </p>
              </div>
            </div>
          )}
        </div>
        
        <Button
          onClick={handleOptimize}
          disabled={optimizing || !selectedRulesetId || !extraBudget || rulesetsLoading}
          className="w-full md:w-auto"
        >
          {optimizing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Optimizing...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              Run Optimization
            </>
          )}
        </Button>
        
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">Error</p>
              <p className="text-sm text-red-600">{error}</p>
            </div>
          </div>
        )}
      </Card>
      
      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-600">Adjustment</p>
                <Percent className="w-5 h-5 text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-[#1E1E1E]">
                {(() => {
                  const plan = result.adjustmentPlan || result.raisePlan;
                  if (result.strategy === 'FLAT_RAISE_ON_BASE') {
                    // For flat raise, show amount instead of percentage
                    if (plan.scalarOrFactor) {
                      return formatCurrency(plan.scalarOrFactor);
                    } else if (plan.percentage) {
                      // Fallback: calculate from percentage if scalarOrFactor not available
                      const baselineComponentTotal = parseFloat(result.baseline?.componentTotals?.[plan.targetComponent || ''] || '0');
                      const employeeCount = result.baseline?.employeeCount || 1;
                      const raiseAmount = (baselineComponentTotal * parseFloat(plan.percentage)) / 100 / employeeCount;
                      return formatCurrency(raiseAmount);
                    }
                  } else if (plan.percentage) {
                    return formatPercent(plan.percentage);
                  } else if (plan.scalarOrFactor) {
                    const value = parseFloat(plan.scalarOrFactor);
                    if (result.strategy === 'INCREASE_TABLE_VALUES') {
                      return formatPercent(value * 100);
                    } else {
                      return formatCurrency(value);
                    }
                  }
                  return 'N/A';
                })()}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {(() => {
                  const plan = result.adjustmentPlan || result.raisePlan;
                  if (plan.targetComponent) {
                    return `on ${plan.targetComponent}`;
                  } else if (plan.newComponentName) {
                    return `${plan.newComponentName} in ${plan.targetGroup || 'group'}`;
                  } else if (plan.targetTable) {
                    return `table ${plan.targetTable}`;
                  }
                  return '';
                })()}
              </p>
            </Card>
            
            <Card className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-600">Baseline Cost</p>
                <DollarSign className="w-5 h-5 text-gray-600" />
              </div>
              <p className="text-2xl font-bold text-[#1E1E1E]">
                {formatCurrency(result.baseline.totalCost)}
              </p>
              <p className="text-xs text-gray-500 mt-1">Current total</p>
            </Card>
            
            <Card className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-600">Optimized Cost</p>
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(result.optimized.totalCost)}
              </p>
              <p className="text-xs text-gray-500 mt-1">After raise</p>
            </Card>
            
            <Card className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-600">Extra Cost Used</p>
                <DollarSign className="w-5 h-5 text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-blue-600">
                {formatCurrency(result.extraCostUsed)}
              </p>
              <p className="text-xs text-gray-500 mt-1">of {formatCurrency(result.extraBudget)} budget</p>
            </Card>
          </div>
          
          {/* Comparison Card */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Baseline vs Optimized</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-600 mb-3">Baseline</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Total Cost:</span>
                    <span className="font-medium">{formatCurrency(result.baseline.totalCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Avg per Employee:</span>
                    <span className="font-medium">{formatCurrency(result.baseline.avgPerEmployee)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Employee Count:</span>
                    <span className="font-medium">{result.baseline.employeeCount}</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-600 mb-3">Optimized</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Total Cost:</span>
                    <span className="font-medium text-green-600">{formatCurrency(result.optimized.totalCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Avg per Employee:</span>
                    <span className="font-medium text-green-600">{formatCurrency(result.optimized.avgPerEmployee)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Employee Count:</span>
                    <span className="font-medium">{result.optimized.employeeCount}</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
          
          {/* Adjustment Plan Description */}
          <Card className="p-6 bg-blue-50 border-blue-200">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-blue-900 mb-1">Optimization Result</h3>
                <p className="text-sm text-blue-800">
                  {(result.adjustmentPlan || result.raisePlan).description}. This will increase the total employer cost by approximately{' '}
                  {formatCurrency(result.extraCostUsed)} per year, using{' '}
                  {((parseFloat(result.extraCostUsed) / parseFloat(result.extraBudget)) * 100).toFixed(1)}% of your extra budget.
                </p>
              </div>
            </div>
          </Card>
          
          {/* Action Button */}
          <div className="flex justify-end">
            <Button
              onClick={() => setShowSaveDialog(true)}
              variant="outline"
              className="gap-2"
            >
              <Save className="w-4 h-4" />
              Save as Scenario
            </Button>
          </div>
        </div>
      )}
      
      {/* Empty State */}
      {!result && !optimizing && !error && (
        <Card className="p-12 text-center">
          <TrendingUp className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">Ready to Optimize</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            Select a ruleset, enter your extra yearly budget, and click "Run Optimization" to find the optimal raise percentage.
          </p>
        </Card>
      )}
      
      {/* Save Scenario Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Optimization as Scenario</DialogTitle>
            <p className="text-sm text-gray-500 mt-2">
              Save this optimization result for later review and comparison.
            </p>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="scenario-name">Scenario Name</Label>
              <Input
                id="scenario-name"
                value={scenarioName}
                onChange={(e) => setScenarioName(e.target.value)}
                placeholder="e.g., 5% Base Raise - Jan 2024"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowSaveDialog(false);
                setScenarioName('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveAsScenario}
              disabled={!scenarioName.trim() || savingScenario}
            >
              {savingScenario ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

