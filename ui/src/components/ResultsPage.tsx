import { useState } from 'react';
import { Download, Play, FileText, TrendingUp, Users, DollarSign } from 'lucide-react';
import { Card } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';

interface Simulation {
  id: number;
  name: string;
  date: string;
  period: string;
  ruleset: string;
  total: string;
  employees: number;
  avgPerEmployee: string;
}

export default function ResultsPage() {
  const [selectedSimulation, setSelectedSimulation] = useState<Simulation | null>(null);

  const simulations: Simulation[] = [
    {
      id: 1,
      name: 'Q4 2024 - Engineering',
      date: '2024-11-08',
      period: 'Oct - Dec 2024',
      ruleset: '2024 Annual Rules',
      total: '$425,000',
      employees: 45,
      avgPerEmployee: '$9,444',
    },
    {
      id: 2,
      name: 'November 2024 - All Staff',
      date: '2024-11-07',
      period: 'Nov 2024',
      ruleset: '2024 Annual Rules',
      total: '$1,250,000',
      employees: 1247,
      avgPerEmployee: '$1,002',
    },
    {
      id: 3,
      name: 'Bonus Scenario A',
      date: '2024-11-05',
      period: 'Dec 2024',
      ruleset: 'Q4 2024 Bonus',
      total: '$85,000',
      employees: 120,
      avgPerEmployee: '$708',
    },
    {
      id: 4,
      name: 'Q3 2024 - Sales Team',
      date: '2024-10-30',
      period: 'Jul - Sep 2024',
      ruleset: '2024 Annual Rules',
      total: '$320,000',
      employees: 32,
      avgPerEmployee: '$10,000',
    },
    {
      id: 5,
      name: 'Annual Review 2024',
      date: '2024-10-28',
      period: 'Jan - Dec 2024',
      ruleset: '2024 Annual Rules',
      total: '$5,200,000',
      employees: 1247,
      avgPerEmployee: '$4,169',
    },
    {
      id: 6,
      name: 'Q2 2024 - Operations',
      date: '2024-10-15',
      period: 'Apr - Jun 2024',
      ruleset: '2024 Annual Rules',
      total: '$280,000',
      employees: 78,
      avgPerEmployee: '$3,590',
    },
  ];

  const componentBreakdown = [
    { component: 'Base Salary', amount: 285000, percentage: 67.1 },
    { component: 'Performance Bonus', amount: 42750, percentage: 10.1 },
    { component: 'Pension Contribution', amount: 22800, percentage: 5.4 },
    { component: 'Stock Options', amount: 34200, percentage: 8.0 },
    { component: 'Health Insurance', amount: 18000, percentage: 4.2 },
    { component: 'Overtime Pay', amount: 15000, percentage: 3.5 },
    { component: 'Commission', amount: 7250, percentage: 1.7 },
  ];

  const handleRowClick = (sim: Simulation) => {
    setSelectedSimulation(sim);
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-[#1E1E1E]">Results – History & Details</h1>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-[#0052CC]" />
            </div>
            <div className="text-sm text-gray-600">Total Payroll</div>
          </div>
          <div className="text-2xl text-[#1E1E1E]">$7.56M</div>
          <div className="text-sm text-green-600 mt-1">+12.3% vs last month</div>
        </Card>

        <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <div className="text-sm text-gray-600">Avg per Employee</div>
          </div>
          <div className="text-2xl text-[#1E1E1E]">$6,063</div>
          <div className="text-sm text-gray-600 mt-1">Across 1,247 employees</div>
        </Card>

        <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-purple-600" />
            </div>
            <div className="text-sm text-gray-600">Simulations Run</div>
          </div>
          <div className="text-2xl text-[#1E1E1E]">47</div>
          <div className="text-sm text-gray-600 mt-1">This month</div>
        </Card>

        <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-orange-600" />
            </div>
            <div className="text-sm text-gray-600">Growth Rate</div>
          </div>
          <div className="text-2xl text-[#1E1E1E]">8.7%</div>
          <div className="text-sm text-gray-600 mt-1">Year over year</div>
        </Card>
      </div>

      {/* Simulations Table */}
      <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
        <h3 className="text-[#1E1E1E] mb-4">Simulation History</h3>
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
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                      className="p-2 hover:bg-gray-200 rounded transition-colors"
                    >
                      <Download className="w-4 h-4 text-gray-600" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
                      <div className="text-sm text-[#1E1E1E]">${comp.amount.toLocaleString()}</div>
                      <div className="text-xs text-gray-600">{comp.percentage}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <button className="flex items-center gap-2 px-6 py-3 bg-white text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors">
                <Download className="w-5 h-5" />
                Download CSV
              </button>
              <button className="flex items-center gap-2 px-6 py-3 bg-[#0052CC] text-white rounded-xl hover:bg-[#0047b3] transition-colors">
                <Play className="w-5 h-5" />
                Re-run Simulation
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
