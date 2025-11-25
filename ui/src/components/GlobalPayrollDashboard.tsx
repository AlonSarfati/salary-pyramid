import { useState, useEffect } from 'react';
import { DollarSign, Users, TrendingUp, FileText, Loader2, Info, Play, ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from './ui/card';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { baselineApi, rulesetApi, componentGroupsApi, type BaselineSummary, type BaselineTrendPoint, type BaselineBreakdown, type FullSimulationResult, type ComponentGroup } from '../services/apiService';
import { ChartTooltip } from './ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

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
  
  // Ruleset selection and full simulation
  const [allRulesets, setAllRulesets] = useState<Array<{ rulesetId: string; name: string; status: string }>>([]);
  const [selectedRulesetId, setSelectedRulesetId] = useState<string | null>(null);
  const [fullSimulationResult, setFullSimulationResult] = useState<FullSimulationResult | null>(null);
  const [runningSimulation, setRunningSimulation] = useState(false);
  const [showFullSimulation, setShowFullSimulation] = useState(false);
  
  // Component groups for colors
  const [componentGroups, setComponentGroups] = useState<ComponentGroup[]>([]);

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
          // Set default to active ruleset if available
          const activeRuleset = rulesets.find(r => r.status === 'ACTIVE');
          if (activeRuleset) {
            setSelectedRulesetId(activeRuleset.rulesetId);
          } else if (rulesets.length > 0) {
            setSelectedRulesetId(rulesets[0].rulesetId);
          }
        }
      } catch (e: any) {
        console.error('Failed to load rulesets:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [tenantId]);

  // Load dashboard data
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        
        const [summaryData, trendData, breakdownData, simCountData] = await Promise.all([
          baselineApi.getSummary(tenantId, undefined, selectedRulesetId || undefined),
          baselineApi.getTrend(tenantId),
          baselineApi.getBreakdown(tenantId, undefined, selectedRulesetId || undefined),
          baselineApi.getSimulationCount(tenantId),
        ]);
        
        if (!cancelled) {
          setSummary(summaryData);
          setTrend(trendData);
          setBreakdown(breakdownData);
          setSimulationCount(simCountData.count);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message || 'Failed to load dashboard data');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [tenantId, selectedRulesetId]);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Calculate growth rate (placeholder - would need historical data)
  const growthRate = null; // TODO: Implement when baseline snapshots are available

  // Prepare breakdown data for charts
  const breakdownData = breakdown ? Object.entries(breakdown.categoryTotals)
    .filter(([_, value]) => value > 0)
    .map(([category, value]) => ({
      category,
      value: Number(value),
    })) : [];

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
      alert('Please select a ruleset first');
      return;
    }

    try {
      setRunningSimulation(true);
      setError(null);
      const result = await baselineApi.runFullSimulation(tenantId, selectedRulesetId);
      setFullSimulationResult(result);
      setShowFullSimulation(true);
    } catch (e: any) {
      setError(e.message || 'Failed to run full simulation');
    } finally {
      setRunningSimulation(false);
    }
  };

  if (loading) {
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
            {summary ? formatCurrency(summary.totalPayroll) : '-'}
          </div>
        </Card>

        <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <div className="text-sm text-gray-600">Avg Payroll Per Employee</div>
          </div>
          <div className="text-2xl text-[#1E1E1E]">
            {summary ? formatCurrency(summary.avgPerEmployee) : '-'}
          </div>
          <div className="text-sm text-gray-600 mt-1">
            Across {summary?.employeeCount || 0} employees
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
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
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
            <h3 className="text-[#1E1E1E] mb-4">Component Totals</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm text-gray-600">Component</th>
                    <th className="text-right py-3 px-4 text-sm text-gray-600">Total</th>
                    <th className="text-right py-3 px-4 text-sm text-gray-600">Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(fullSimulationResult.componentTotals)
                    .sort(([, a], [, b]) => b - a)
                    .map(([component, total]) => {
                      const percentage = (total / fullSimulationResult.grandTotal) * 100;
                      return (
                        <tr key={component} className="border-b border-gray-100">
                          <td className="py-3 px-4 text-sm text-[#1E1E1E]">{component}</td>
                          <td className="py-3 px-4 text-sm text-[#0052CC] text-right">
                            {formatCurrency(total)}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600 text-right">
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

