import { useState, useEffect } from 'react';
import { TrendingUp, Play, Save, Loader2, AlertCircle, CheckCircle2, DollarSign, Users, Percent, Info } from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { optimizerApi, rulesetApi, scenarioApi, type OptimizationResult, type OptimizeRequest } from '../services/apiService';
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
  const [targetComponent, setTargetComponent] = useState<string>('Base');
  
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
    
    setOptimizing(true);
    setError(null);
    setResult(null);
    
    try {
      const request: OptimizeRequest = {
        tenantId,
        rulesetId: selectedRulesetId,
        extraBudget: budgetValue,
        strategy,
        targetComponent,
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
      const inputData = {
        optimizer: true,
        extraBudget: result.extraBudget || '0',
        strategy: result.strategy || 'FLAT_RAISE_ON_BASE',
        raisePlan: result.raisePlan || {
          strategy: result.strategy || 'FLAT_RAISE_ON_BASE',
          targetComponent: result.raisePlan?.targetComponent || 'Base',
          percentage: result.raisePlan?.percentage || '0',
          description: result.raisePlan?.description || '',
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
        raisePlan: result.raisePlan || {
          strategy: result.strategy || 'FLAT_RAISE_ON_BASE',
          targetComponent: result.raisePlan?.targetComponent || 'Base',
          percentage: result.raisePlan?.percentage || '0',
          description: result.raisePlan?.description || '',
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
            <Select value={strategy} onValueChange={setStrategy}>
              <SelectTrigger id="strategy">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FLAT_RAISE_ON_BASE">Flat raise on component</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Target Component Selector */}
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
                <p className="text-sm text-gray-600">Raise Percentage</p>
                <Percent className="w-5 h-5 text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-[#1E1E1E]">
                {formatPercent(result.raisePlan.percentage)}
              </p>
              <p className="text-xs text-gray-500 mt-1">on {result.raisePlan.targetComponent}</p>
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
          
          {/* Raise Plan Description */}
          <Card className="p-6 bg-blue-50 border-blue-200">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-blue-900 mb-1">Optimization Result</h3>
                <p className="text-sm text-blue-800">
                  {result.raisePlan.description}. This will increase the total employer cost by approximately{' '}
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

