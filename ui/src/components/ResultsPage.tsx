import { useState, useEffect } from 'react';
import { Download, Play, FileText, TrendingUp, Users, DollarSign, Loader2, Trash2 } from 'lucide-react';
import { Card } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { scenarioApi, type Scenario } from '../services/apiService';
import { useCurrency } from '../hooks/useCurrency';
import { formatCurrencyWithDecimals, formatCurrencyCompact } from '../utils/currency';
import { useToast } from "./ToastProvider";

interface Simulation {
  id: string;
  name: string;
  date: string;
  period: string;
  ruleset: string;
  total: string;
  employees: number;
  avgPerEmployee: string;
  scenario: Scenario;
}

type Page = 'home' | 'simulate-single' | 'simulate-bulk' | 'rule-builder' | 'visual' | 'results' | 'admin' | 'employees';

interface ResultsPageProps {
  tenantId?: string;
  onNavigate?: (page: Page) => void;
}

export default function ResultsPage({ tenantId = 'default', onNavigate }: ResultsPageProps) {
  // Get currency for tenant
  const currency = useCurrency(tenantId);
  const { showToast } = useToast();
  
  const [selectedSimulation, setSelectedSimulation] = useState<Simulation | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteScenarioDialog, setShowDeleteScenarioDialog] = useState(false);
  const [scenarioIdToDelete, setScenarioIdToDelete] = useState<string | null>(null);
  const [showClearHistoryDialog, setShowClearHistoryDialog] = useState(false);

  // Fetch scenarios on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await scenarioApi.list(tenantId);
        if (!cancelled) {
          setScenarios(data);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message || 'Failed to load scenarios');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [tenantId]);

  // Convert scenarios to Simulation format
  const simulations: Simulation[] = scenarios.map(scenario => {
    const total = typeof scenario.resultData.total === 'string' 
      ? parseFloat(scenario.resultData.total) 
      : (scenario.resultData.total as number) || 0;
    const components = scenario.resultData.components || {};
    const employeeCount = scenario.simulationType === 'bulk' 
      ? (scenario.resultData.results?.length || 1)
      : 1;
    
    // Format pay month as period
    const [year, month] = scenario.payMonth.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const period = `${monthNames[parseInt(month) - 1]} ${year}`;
    
    return {
      id: scenario.scenarioId,
      name: scenario.name,
      date: new Date(scenario.createdAt).toISOString().split('T')[0],
      period,
      ruleset: scenario.rulesetId,
      total: formatCurrencyWithDecimals(total, currency, 2),
      employees: employeeCount,
      avgPerEmployee: formatCurrencyWithDecimals(total / employeeCount, currency, 2),
      scenario,
    };
  });

  // Calculate KPIs from simulation history
  const simulationsCount = simulations.length;
  const totalEmployeesSimulated = simulations.reduce((sum, sim) => sum + sim.employees, 0);
  const avgEmployeesPerRun = simulationsCount > 0 ? totalEmployeesSimulated / simulationsCount : 0;
  const bulkSimulations = simulations.filter(sim => sim.scenario.simulationType === 'bulk').length;
  const singleSimulations = simulationsCount - bulkSimulations;
  const distinctRulesetsUsed = new Set(simulations.map(sim => sim.ruleset)).size;

  // Get component breakdown from selected simulation
  const componentBreakdown = selectedSimulation ? (() => {
    const components = selectedSimulation.scenario.resultData.components || {};
    const total = typeof selectedSimulation.scenario.resultData.total === 'string'
      ? parseFloat(selectedSimulation.scenario.resultData.total)
      : (selectedSimulation.scenario.resultData.total as number) || 0;
    
    return Object.entries(components)
      .map(([component, amount]) => {
        const numAmount = typeof amount === 'string' ? parseFloat(amount) : (amount as number) || 0;
        return {
          component,
          amount: numAmount,
          percentage: total > 0 ? Math.round((numAmount / total) * 10000) / 100 : 0, // Round to 2 decimal places
        };
      })
      .sort((a, b) => b.amount - a.amount);
  })() : [];

  const handleDeleteScenario = async (scenarioId: string) => {
    try {
      await scenarioApi.delete(tenantId, scenarioId);
      setScenarios(scenarios.filter(s => s.scenarioId !== scenarioId));
      if (selectedSimulation?.id === scenarioId) {
        setSelectedSimulation(null);
      }
      showToast("success", "Scenario deleted", "The scenario was removed from history.");
    } catch (e: any) {
      showToast("error", "Failed to delete scenario", e.message || "Unknown error");
    }
  };

  const handleRerunSimulation = () => {
    if (!selectedSimulation) return;
    
    // Store scenario data in localStorage so SimulateSingle can load it
    const scenarioData = {
      rulesetId: selectedSimulation.scenario.rulesetId,
      payMonth: selectedSimulation.scenario.payMonth,
      inputData: selectedSimulation.scenario.inputData,
    };
    localStorage.setItem('rerunScenario', JSON.stringify(scenarioData));
    
    // Navigate to simulate page
    if (onNavigate) {
      onNavigate('simulate-single');
    } else {
      // Fallback: use window event or direct navigation
      window.dispatchEvent(new CustomEvent('navigate', { detail: 'simulate-single' }));
    }
  };

  const handleRowClick = (sim: Simulation) => {
    setSelectedSimulation(sim);
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-[#1E1E1E]">Results – History & Details</h1>
        {simulationsCount > 0 && (
          <button
            onClick={() => setShowClearHistoryDialog(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-red-300 text-red-700 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Clear history
          </button>
        )}
      </div>

      {/* KPI Summary Cards - Simulation history focused */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-[#0052CC]" />
            </div>
            <div className="text-sm text-gray-600">Simulations Run</div>
          </div>
          <div className="text-2xl text-[#1E1E1E]">
            {loading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              simulationsCount
            )}
          </div>
          <div className="text-sm text-gray-600 mt-1">Saved scenarios</div>
        </Card>

        <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <div className="text-sm text-gray-600">Employees Simulated</div>
          </div>
          <div className="text-2xl text-[#1E1E1E]">
            {loading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              totalEmployeesSimulated
            )}
          </div>
          <div className="text-sm text-gray-600 mt-1">
            Avg {avgEmployeesPerRun.toFixed(1)} employees per run
          </div>
        </Card>

        <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-purple-600" />
            </div>
            <div className="text-sm text-gray-600">Rulesets Used</div>
          </div>
          <div className="text-2xl text-[#1E1E1E]">
            {loading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              distinctRulesetsUsed
            )}
          </div>
          <div className="text-sm text-gray-600 mt-1">Unique rulesets in history</div>
        </Card>

        <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-orange-600" />
            </div>
            <div className="text-sm text-gray-600">Run Mix</div>
          </div>
          <div className="text-2xl text-[#1E1E1E]">
            {loading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              simulationsCount > 0
                ? `${singleSimulations} single / ${bulkSimulations} bulk`
                : 'No runs'
            )}
          </div>
          <div className="text-sm text-gray-600 mt-1">Simulation types over time</div>
        </Card>
      </div>

      {/* Simulations Table */}
      <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
        <h3 className="text-[#1E1E1E] mb-4">Simulation History</h3>
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#0052CC]" />
          </div>
        ) : simulations.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No scenarios saved yet. Run a simulation and save it to see it here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm text-gray-600">Name</th>
                  <th className="text-left py-3 px-4 text-sm text-gray-600">Date</th>
                  <th className="text-left py-3 px-4 text-sm text-gray-600">Period</th>
                  <th className="text-left py-3 px-4 text-sm text-gray-600">Ruleset</th>
                  <th className="text-right py-3 px-4 text-sm text-gray-600">Total</th>
                  <th className="text-right py-3 px-4 text-sm text-gray-600">Employees</th>
                  <th className="text-right py-3 px-4 text-sm text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {simulations.map((sim) => (
                  <tr
                    key={sim.id}
                    onClick={() => handleRowClick(sim)}
                    className="border-b border-gray-100 hover:bg-[#EEF2F8] cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 text-sm text-[#1E1E1E]">{sim.name}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{sim.date}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{sim.period}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{sim.ruleset}</td>
                    <td className="py-3 px-4 text-sm text-[#0052CC] text-right">{sim.total}</td>
                    <td className="py-3 px-4 text-sm text-gray-600 text-right">{sim.employees}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setScenarioIdToDelete(sim.id);
                            setShowDeleteScenarioDialog(true);
                          }}
                          className="p-2 hover:bg-red-100 rounded transition-colors"
                          title="Delete scenario"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // TODO: Implement download
                          }}
                          className="p-2 hover:bg-gray-200 rounded transition-colors"
                          title="Download"
                        >
                          <Download className="w-4 h-4 text-gray-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Details Modal */}
      <Dialog open={!!selectedSimulation} onOpenChange={() => setSelectedSimulation(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedSimulation?.name}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-[#EEF2F8] rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Period</div>
                <div className="text-[#1E1E1E]">{selectedSimulation?.period}</div>
              </div>
              <div className="p-4 bg-[#EEF2F8] rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Total Cost</div>
                <div className="text-[#0052CC]">{selectedSimulation?.total}</div>
              </div>
              <div className="p-4 bg-[#EEF2F8] rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Avg per Employee</div>
                <div className="text-[#1E1E1E]">{selectedSimulation?.avgPerEmployee}</div>
              </div>
            </div>

            {/* Component Breakdown */}
            <div>
              <h4 className="text-[#1E1E1E] mb-3">Component Breakdown</h4>
              <div className="space-y-2">
                {componentBreakdown.map((comp, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="text-sm text-[#1E1E1E]">{comp.component}</div>
                      <div className="flex-1 mx-4">
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#0052CC]"
                            style={{ width: `${comp.percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="text-right min-w-[120px]">
                      <div className="text-sm text-[#1E1E1E]">{formatCurrencyWithDecimals(comp.amount, currency, 0)}</div>
                      <div className="text-xs text-gray-600">{comp.percentage.toFixed(2)}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200">
              <button className="flex items-center gap-2 px-6 py-3 bg-white text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors">
                <Download className="w-5 h-5" />
                Download CSV
              </button>
              <button 
                onClick={handleRerunSimulation}
                className="flex items-center gap-2 px-6 py-3 bg-[#0052CC] text-white rounded-xl hover:bg-[#0047b3] transition-colors"
              >
                <Play className="w-5 h-5" />
                Re-run Simulation
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Scenario Dialog */}
      <Dialog open={showDeleteScenarioDialog} onOpenChange={setShowDeleteScenarioDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Scenario</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 mt-2">
            Are you sure you want to delete this scenario from the history?
          </p>
          <DialogFooter className="mt-4">
            <button
              className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
              onClick={() => setShowDeleteScenarioDialog(false)}
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
              onClick={async () => {
                if (!scenarioIdToDelete) return;
                await handleDeleteScenario(scenarioIdToDelete);
                setScenarioIdToDelete(null);
                setShowDeleteScenarioDialog(false);
              }}
            >
              Delete
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear History Dialog */}
      <Dialog open={showClearHistoryDialog} onOpenChange={setShowClearHistoryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear History</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 mt-2">
            This will remove all saved scenarios for this tenant. Do you want to continue?
          </p>
          <DialogFooter className="mt-4">
            <button
              className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
              onClick={() => setShowClearHistoryDialog(false)}
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
              onClick={async () => {
                try {
                  await scenarioApi.clearAll(tenantId);
                  setScenarios([]);
                  setSelectedSimulation(null);
                  showToast("success", "History cleared", "All scenarios were removed for this tenant.");
                } catch (e: any) {
                  showToast("error", "Failed to clear history", e.message || "Unknown error");
                } finally {
                  setShowClearHistoryDialog(false);
                }
              }}
            >
              Clear history
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

