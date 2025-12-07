import { useState, useEffect, useRef } from 'react';
import { DollarSign, Users, TrendingUp, FileText, Loader2, Info, Play, ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from './ui/card';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { baselineApi, rulesetApi, componentGroupsApi, type BaselineSummary, type BaselineTrendPoint, type BaselineBreakdown, type FullSimulationResult, type ComponentGroup } from '../services/apiService';
import { ChartTooltip } from './ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { useCurrency } from '../hooks/useCurrency';
import { formatCurrency as formatCurrencyUtil, formatCurrencyCompact } from '../utils/currency';
import { useToast } from "./ToastProvider";

interface GlobalPayrollDashboardProps {
  tenantId?: string;
}

export default function GlobalPayrollDashboard({ tenantId = 'default' }: GlobalPayrollDashboardProps) {
  const [summary, setSummary] = useState<BaselineSummary | null>(null);
  const [trend, setTrend] = useState<BaselineTrendPoint[]>([]);
  const [breakdown, setBreakdown] = useState<BaselineBreakdown | null>(null);
  const [simulationCount, setSimulationCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Track which ruleset the current data belongs to, to prevent showing stale data
  const [dataRulesetId, setDataRulesetId] = useState<string | null>(null);
  const { showToast } = useToast();
  
  // Ruleset selection and full simulation
  const [allRulesets, setAllRulesets] = useState<Array<{ rulesetId: string; name: string; status: string }>>([]);
  const [selectedRulesetId, setSelectedRulesetId] = useState<string | null>(null);
  const [fullSimulationResult, setFullSimulationResult] = useState<FullSimulationResult | null>(null);
  const [runningSimulation, setRunningSimulation] = useState(false);
  const [showFullSimulation, setShowFullSimulation] = useState(false);
  
  // Global ruleset persistence key
  const GLOBAL_RULESET_KEY = `globalRuleset_${tenantId}`;
  
  // Component groups for colors
  const [componentGroups, setComponentGroups] = useState<ComponentGroup[]>([]);
  
  // Ref to track if a dashboard data request is in progress
  const loadingRef = useRef(false);
  // Ref to track the current request's AbortController
  const abortControllerRef = useRef<AbortController | null>(null);
  // Ref to track the latest request ID to prevent stale data
  const requestIdRef = useRef(0);

  // Load component groups
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const groups = await componentGroupsApi.getAll();
        if (!cancelled) {
          setComponentGroups(groups);
        }
      } catch (e: any) {
        console.error('Failed to load component groups:', e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Load all rulesets
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rulesets = await rulesetApi.getAllRulesets(tenantId);
        if (!cancelled) {
          setAllRulesets(rulesets);
          if (rulesets.length > 0) {
            let initialRulesetId: string | null = null;
            
            // Try to restore from global storage
            const storedGlobalRuleset = localStorage.getItem(GLOBAL_RULESET_KEY);
            if (storedGlobalRuleset) {
              try {
                const { rulesetId: storedId } = JSON.parse(storedGlobalRuleset);
                if (rulesets.some(r => r.rulesetId === storedId)) {
                  initialRulesetId = storedId;
                }
              } catch (e) {
                console.warn('Failed to parse global ruleset from localStorage:', e);
              }
            }
            
            // Fallback to active ruleset or first one
            if (!initialRulesetId) {
              const activeRuleset = rulesets.find(r => r.status === 'ACTIVE');
              initialRulesetId = activeRuleset ? activeRuleset.rulesetId : rulesets[0].rulesetId;
            }
            
            setSelectedRulesetId(initialRulesetId);
          }
        }
      } catch (e: any) {
        console.error('Failed to load rulesets:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [tenantId]);

  // Load dashboard data (trend, breakdown, simulation count - but NOT the total payroll)
  // The total payroll will only be shown after the user explicitly runs a full simulation
  useEffect(() => {
    if (!selectedRulesetId) {
      // Don't load data if no ruleset is selected - clear state atomically
      setLoading(false);
      setSummary(null);
      setTrend([]);
      setBreakdown(null);
      setSimulationCount(0);
      setDataRulesetId(null);
      setError(null);
      return;
    }
    
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new AbortController for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    
    // Increment request ID to track the latest request
    const currentRequestId = ++requestIdRef.current;
    
    let cancelled = false;
    loadingRef.current = true;
    
    // Clear previous breakdown when ruleset changes
    setBreakdown(null);
    setLoading(true);
    setError(null);
    
    (async () => {
      try {
        // Load only trend, breakdown, and simulation count
        // Do NOT load the total payroll automatically - it will be set when user clicks "Run Full Simulation"
        const [trendData, breakdownData, simCountData] = await Promise.all([
          baselineApi.getTrend(tenantId),
          baselineApi.getBreakdown(tenantId, undefined, selectedRulesetId),
          baselineApi.getSimulationCount(tenantId),
        ]);
        
        // Check if request was cancelled, ruleset changed, or this is not the latest request
        if (abortController.signal.aborted || cancelled || !selectedRulesetId || currentRequestId !== requestIdRef.current) {
          return; // Don't update state if cancelled or superseded by a newer request
        }
        
        // Update state if this is still the latest request
        if (selectedRulesetId && currentRequestId === requestIdRef.current) {
          setTrend(trendData);
          setBreakdown(breakdownData);
          setSimulationCount(simCountData.count);
          setLoading(false);
          setError(null);
        }
      } catch (e: any) {
        // Ignore abort errors
        if (e.name === 'AbortError' || abortController.signal.aborted) {
          return;
        }
        
        if (!cancelled && selectedRulesetId && !abortController.signal.aborted) {
          setError(e.message || 'Failed to load dashboard data');
          setLoading(false);
          // Clear data on error to prevent showing stale data
          setBreakdown(null);
        }
      } finally {
        if (!cancelled && !abortController.signal.aborted) {
          loadingRef.current = false;
        }
      }
    })();
    return () => { 
      cancelled = true;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      loadingRef.current = false;
    };
  }, [tenantId, selectedRulesetId]);

  // Get currency for tenant
  const currency = useCurrency(tenantId);
  
  // Format currency using utility
  const formatCurrency = (amount: number) => {
    return formatCurrencyUtil(amount, currency);
  };

  // Calculate growth rate (placeholder - would need historical data)
  const growthRate = null; // TODO: Implement when baseline snapshots are available

  // Prepare breakdown data for charts
  const breakdownData = breakdown 
    ? Object.entries(breakdown.categoryTotals)
        .filter(([_, value]) => value > 0)
        .map(([category, value]) => ({
          category,
          value: Number(value),
        })) 
    : [];

  // Create a map of displayName -> color from component groups
  const categoryColorMap = new Map<string, string>();
  componentGroups.forEach(group => {
    categoryColorMap.set(group.displayName, group.color);
  });
  
  // Get colors for breakdown data, using group colors or fallback
  const getColorForCategory = (category: string, index: number): string => {
    return categoryColorMap.get(category) || ['#0052CC', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4'][index % 6];
  };

  const handleRunFullSimulation = async () => {
    if (!selectedRulesetId) {
      showToast("error", "No ruleset selected", "Please choose a ruleset before running a full simulation.");
      return;
    }

    try {
      setRunningSimulation(true);
      setError(null);
      // Use the SAME date as the dashboard (first of current month) for consistency
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const asOfDate = `${year}-${month}-01`;
      const result = await baselineApi.runFullSimulation(tenantId, selectedRulesetId, asOfDate);
      
      // Update the dashboard summary with the result from the explicit simulation
      // This ensures the dashboard card shows the exact same data as the simulation result
      const avgPerEmployee = result.employeeCount > 0
        ? result.grandTotal / result.employeeCount
        : 0;
      
      const summaryData: BaselineSummary = {
        totalPayroll: result.grandTotal,
        avgPerEmployee: avgPerEmployee,
        employeeCount: result.employeeCount,
        activeRulesetName: result.rulesetName,
        activeRulesetId: result.rulesetId,
        asOfDate: result.asOfDate,
        calculatedAt: result.calculatedAt,
      };
      
      setSummary(summaryData);
      setDataRulesetId(selectedRulesetId);
      setFullSimulationResult(result);
      setShowFullSimulation(true);
    } catch (e: any) {
      setError(e.message || 'Failed to run full simulation');
    } finally {
      setRunningSimulation(false);
    }
  };

  // Show loading state only if we're actively loading AND we don't have any data yet
  // Since we no longer auto-load summary, we should allow the page to render even without summary
  const isDataLoading = loading && !trend.length && !breakdown && simulationCount === 0;
  
  if (isDataLoading) {
    return (
      <div className="p-8 max-w-[1600px] mx-auto">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#0052CC]" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-[1600px] mx-auto">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-[#1E1E1E]">Global Payroll Dashboard</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <Label htmlFor="ruleset-select" className="text-sm font-medium text-gray-700">Ruleset:</Label>
            <Select
              value={selectedRulesetId || ''}
              onValueChange={(value) => {
                setSelectedRulesetId(value);
                setShowFullSimulation(false);
                setFullSimulationResult(null);
                const selected = allRulesets.find(rs => rs.rulesetId === value);
                const name = selected?.name || value;
                localStorage.setItem(GLOBAL_RULESET_KEY, JSON.stringify({ rulesetId: value, name }));
              }}
            >
              <SelectTrigger id="ruleset-select" className="w-[300px]">
                <SelectValue placeholder="Select ruleset..." />
              </SelectTrigger>
              <SelectContent>
                {allRulesets.map((rs) => (
                  <SelectItem key={rs.rulesetId} value={rs.rulesetId}>
                    {rs.name} {rs.status === 'ACTIVE' && '(Active)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <button
            onClick={handleRunFullSimulation}
            disabled={!selectedRulesetId || runningSimulation}
            className="flex items-center gap-2 px-6 py-3 bg-[#0052CC] text-white rounded-xl hover:bg-[#0047b3] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {runningSimulation ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                Run Full Simulation
              </>
            )}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-[#0052CC]" />
            </div>
            <div className="text-sm text-gray-600">Total Current Payroll</div>
          </div>
          <div className="text-2xl text-[#1E1E1E]">
            {summary && dataRulesetId === selectedRulesetId 
              ? formatCurrency(summary.totalPayroll)
              : fullSimulationResult && showFullSimulation
                ? formatCurrency(fullSimulationResult.grandTotal)
                : '-'}
          </div>
          {!summary && !fullSimulationResult && (
            <div className="text-xs text-gray-500 mt-1">
              Click "Run Full Simulation" to calculate
            </div>
          )}
        </Card>

        <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <div className="text-sm text-gray-600">Avg Payroll Per Employee</div>
          </div>
          <div className="text-2xl text-[#1E1E1E]">
            {summary && dataRulesetId === selectedRulesetId 
              ? formatCurrency(summary.avgPerEmployee)
              : fullSimulationResult && showFullSimulation && fullSimulationResult.employeeCount > 0
                ? formatCurrency(fullSimulationResult.grandTotal / fullSimulationResult.employeeCount)
                : '-'}
          </div>
          <div className="text-sm text-gray-600 mt-1">
            Across {summary && dataRulesetId === selectedRulesetId 
              ? (summary.employeeCount || 0)
              : fullSimulationResult && showFullSimulation
                ? fullSimulationResult.employeeCount
                : 0} employees
          </div>
        </Card>

        <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-purple-600" />
            </div>
            <div className="text-sm text-gray-600">Total Simulations Run</div>
          </div>
          <div className="text-2xl text-[#1E1E1E]">{simulationCount}</div>
          <div className="text-sm text-gray-600 mt-1">Usage metric</div>
        </Card>

        <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-orange-600" />
            </div>
            <div className="text-sm text-gray-600">Payroll Growth Rate</div>
          </div>
          <div className="text-2xl text-[#1E1E1E]">
            {growthRate !== null ? `${growthRate > 0 ? '+' : ''}${growthRate.toFixed(2)}%` : 'N/A'}
          </div>
          <div className="text-sm text-gray-600 mt-1">
            {growthRate === null ? 'No historical data' : 'vs previous baseline'}
          </div>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Monthly Payroll Trend */}
        <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
          <h3 className="text-[#1E1E1E] mb-4">Monthly Payroll Trend</h3>
          {trend.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-gray-500">
              <div className="text-center">
                <p className="mb-2">No historical data available</p>
                <p className="text-sm">Baseline snapshots will appear here once available</p>
              </div>
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend.map(t => ({ month: t.month, payroll: t.totalPayroll }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => formatCurrencyCompact(value, currency)}
                  />
                  <ChartTooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white p-2 border border-gray-200 rounded shadow">
                            <p className="text-sm">{`${payload[0].payload.month}`}</p>
                            <p className="text-sm font-semibold text-[#0052CC]">
                              {formatCurrency(payload[0].value as number)}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="payroll" 
                    stroke="#0052CC" 
                    strokeWidth={2}
                    dot={{ fill: '#0052CC', r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Payroll Composition Breakdown */}
        <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[#1E1E1E]">Payroll Composition Breakdown</h3>
            {breakdown?.calculatedAt && (
              <div className="text-sm text-gray-500">
                Last calculated: {new Date(breakdown.calculatedAt).toLocaleString()}
              </div>
            )}
          </div>
          {breakdownData.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-gray-500">
              <p>No breakdown data available</p>
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={breakdownData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ category, percent }) => `${category}: ${(percent * 100).toFixed(1)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    nameKey="category"
                  >
                    {breakdownData.map((item, index) => (
                      <Cell key={`cell-${index}`} fill={getColorForCategory(item.category, index)} />
                    ))}
                  </Pie>
                  <ChartTooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white p-2 border border-gray-200 rounded shadow">
                            <p className="text-sm font-semibold">{data.category}</p>
                            <p className="text-sm text-[#0052CC]">
                              {formatCurrency(payload[0].value as number)}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {/* Full Simulation Results */}
      {fullSimulationResult && showFullSimulation && (
        <Card className="p-6 bg-white rounded-xl shadow-sm border-0 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-[#1E1E1E] mb-2">Full Simulation Results</h2>
              <p className="text-sm text-gray-600">
                Ruleset: <strong>{fullSimulationResult.rulesetName}</strong> | 
                Employees: <strong>{fullSimulationResult.employeeCount}</strong> | 
                Date: <strong>{new Date(fullSimulationResult.asOfDate).toLocaleDateString()}</strong>
              </p>
              {fullSimulationResult.calculatedAt && (
                <p className="text-sm text-gray-500 mt-1">
                  Last calculated: {new Date(fullSimulationResult.calculatedAt).toLocaleString()}
                </p>
              )}
            </div>
            <button
              onClick={() => setShowFullSimulation(false)}
              className="p-2 hover:bg-gray-100 rounded transition-colors"
            >
              <ChevronUp className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-[#EEF2F8] rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Grand Total</div>
              <div className="text-2xl font-semibold text-[#1E1E1E]">
                {formatCurrency(fullSimulationResult.grandTotal)}
              </div>
            </div>
            <div className="p-4 bg-[#EEF2F8] rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Average Per Employee</div>
              <div className="text-2xl font-semibold text-[#1E1E1E]">
                {formatCurrency(fullSimulationResult.grandTotal / fullSimulationResult.employeeCount)}
              </div>
            </div>
            <div className="p-4 bg-[#EEF2F8] rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Total Components</div>
              <div className="text-2xl font-semibold text-[#1E1E1E]">
                {Object.keys(fullSimulationResult.componentTotals).length}
              </div>
            </div>
          </div>

          {/* Component Totals */}
          <div className="mb-6">
            Nicely distributed by column.
            <h3 className="text-[#1E1E1E] mb-4">Component Totals</h3>
            <div className="overflow-x-auto">
              <table className="w-full table-fixed">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="w-1/2 text-left py-3 px-4 text-sm text-gray-600">Component</th>
                    <th className="w-1/4 text-right py-3 px-4 text-sm text-gray-600">Total</th>
                    <th className="w-1/4 text-right py-3 px-4 text-sm text-gray-600">Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(fullSimulationResult.componentTotals)
                    .sort(([, a], [, b]) => b - a)
                    .map(([component, total]) => {
                      const percentage = (total / fullSimulationResult.grandTotal) * 100;
                      return (
                        <tr key={component} className="border-b border-gray-100">
                          <td className="w-1/2 py-3 px-4 text-sm text-[#1E1E1E]">{component}</td>
                          <td className="w-1/4 py-3 px-4 text-sm text-[#0052CC] text-right">
                            {formatCurrency(total)}
                          </td>
                          <td className="w-1/4 py-3 px-4 text-sm text-gray-600 text-right">
                            {percentage.toFixed(2)}%
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Employee Results */}
          <div>
            <h3 className="text-[#1E1E1E] mb-4">Employee Breakdown</h3>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm text-gray-600">Employee ID</th>
                    <th className="text-left py-3 px-4 text-sm text-gray-600">Name</th>
                    <th className="text-right py-3 px-4 text-sm text-gray-600">Total</th>
                    <th className="text-right py-3 px-4 text-sm text-gray-600">Components</th>
                  </tr>
                </thead>
                <tbody>
                  {fullSimulationResult.employeeResults.map((emp) => (
                    <tr key={emp.employeeId} className="border-b border-gray-100 hover:bg-[#EEF2F8]">
                      <td className="py-3 px-4 text-sm text-[#1E1E1E]">{emp.employeeId}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">{emp.employeeName || '-'}</td>
                      <td className="py-3 px-4 text-sm text-[#0052CC] text-right font-semibold">
                        {formatCurrency(emp.total)}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600 text-right">
                        {Object.keys(emp.components).length} components
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      {/* Metadata Section */}
      <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-[#0052CC] mt-0.5" />
          <div className="flex-1">
            <h3 className="text-[#1E1E1E] mb-3">Dashboard Information</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <div>
                <strong>Active Ruleset:</strong> {summary?.activeRulesetName || 'N/A'}
              </div>
              <div>
                <strong>Last Calculation:</strong> {summary ? new Date(summary.calculatedAt).toLocaleString() : 'N/A'}
              </div>
              <div>
                <strong>Total Employees:</strong> {summary?.employeeCount || 0}
              </div>
              <div className="mt-3 p-3 bg-[#EEF2F8] rounded-lg">
                <strong className="text-[#1E1E1E]">Note:</strong> This dashboard reflects real baseline payroll using the selected ruleset. 
                It does not include simulation results or employer costs (pension, NI, taxes).
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

