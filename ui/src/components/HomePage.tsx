import { Plus, Edit, Upload, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';

type Page = 'home' | 'simulate-single' | 'simulate-bulk' | 'rule-builder' | 'components-graph' | 'results' | 'admin';

interface HomePageProps {
  onNavigate: (page: Page) => void;
}

export default function HomePage({ onNavigate }: HomePageProps) {
  const recentSimulations = [
    { id: 1, name: 'Q4 2024 - Engineering', period: 'Oct - Dec 2024', total: '$425,000', date: '2024-11-08' },
    { id: 2, name: 'November 2024 - All Staff', period: 'Nov 2024', total: '$1,250,000', date: '2024-11-07' },
    { id: 3, name: 'Bonus Scenario A', period: 'Dec 2024', total: '$85,000', date: '2024-11-05' },
    { id: 4, name: 'Q3 2024 - Sales Team', period: 'Jul - Sep 2024', total: '$320,000', date: '2024-10-30' },
    { id: 5, name: 'Annual Review 2024', period: 'Jan - Dec 2024', total: '$5,200,000', date: '2024-10-28' },
  ];

  const draftRulesets = [
    { id: 1, name: '2025 Compensation Rules', status: 'Draft', modified: '2 days ago' },
    { id: 2, name: 'Bonus Structure Update', status: 'Needs Review', modified: '5 days ago' },
    { id: 3, name: 'Q1 2025 Adjustments', status: 'Active', modified: '1 week ago' },
  ];

  const alerts = [
    { id: 1, type: 'error', message: 'Circular dependency detected in Pension → Bonus → Base', ruleset: '2025 Rules' },
    { id: 2, type: 'warning', message: 'Missing input: "Commission Rate" for Sales team', ruleset: 'Q4 2024' },
    { id: 3, type: 'info', message: 'Ruleset "Annual 2024" ready for review', ruleset: 'Annual 2024' },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Draft':
        return 'bg-gray-200 text-gray-700';
      case 'Needs Review':
        return 'bg-yellow-100 text-yellow-800';
      case 'Active':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-200 text-gray-700';
    }
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <h1 className="text-[#1E1E1E] mb-8">Welcome to Atlas Compensation Simulator</h1>

      {/* Quick Actions */}
      <div className="flex gap-4 mb-8">
        <button 
          onClick={() => onNavigate('simulate-single')}
          className="flex items-center gap-2 px-6 py-3 bg-[#0052CC] text-white rounded-xl hover:bg-[#0047b3] transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" />
          New Simulation
        </button>
        <button 
          onClick={() => onNavigate('rule-builder')}
          className="flex items-center gap-2 px-6 py-3 bg-white text-[#0052CC] border border-[#0052CC] rounded-xl hover:bg-[#EEF2F8] transition-colors"
        >
          <Edit className="w-5 h-5" />
          Edit Rules
        </button>
        <button className="flex items-center gap-2 px-6 py-3 bg-white text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors">
          <Upload className="w-5 h-5" />
          Import CSV
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Simulations */}
        <Card className="p-6 bg-white rounded-xl shadow-sm border-0 lg:col-span-2">
          <h3 className="text-[#1E1E1E] mb-4">Recent Simulations</h3>
          <div className="space-y-3">
            {recentSimulations.map((sim) => (
              <div
                key={sim.id}
                className="flex items-center justify-between p-4 bg-[#EEF2F8] rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                onClick={() => onNavigate('results')}
              >
                <div>
                  <div className="text-[#1E1E1E]">{sim.name}</div>
                  <div className="text-gray-600 text-sm">{sim.period}</div>
                </div>
                <div className="text-right">
                  <div className="text-[#0052CC]">{sim.total}</div>
                  <div className="text-gray-500 text-sm">{sim.date}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* System Health */}
        <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
          <h3 className="text-[#1E1E1E] mb-4">System Health</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Active Rulesets</span>
              <span className="text-[#1E1E1E]">3</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Draft Rulesets</span>
              <span className="text-[#1E1E1E]">2</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Last Publish</span>
              <span className="text-[#1E1E1E]">Nov 5, 2024</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total Employees</span>
              <span className="text-[#1E1E1E]">1,247</span>
            </div>
            <div className="pt-4 border-t border-gray-200">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="w-5 h-5" />
                <span>All systems operational</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Draft Rulesets */}
        <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
          <h3 className="text-[#1E1E1E] mb-4">Draft Rulesets</h3>
          <div className="space-y-3">
            {draftRulesets.map((ruleset) => (
              <div
                key={ruleset.id}
                className="p-4 bg-[#EEF2F8] rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                onClick={() => onNavigate('rule-builder')}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="text-[#1E1E1E]">{ruleset.name}</div>
                  <Badge className={getStatusColor(ruleset.status)}>{ruleset.status}</Badge>
                </div>
                <div className="text-gray-500 text-sm flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {ruleset.modified}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Alerts & Validation Errors */}
        <Card className="p-6 bg-white rounded-xl shadow-sm border-0 lg:col-span-2">
          <h3 className="text-[#1E1E1E] mb-4">Alerts & Validation Errors</h3>
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`flex items-start gap-3 p-4 rounded-lg ${
                  alert.type === 'error'
                    ? 'bg-red-50 border border-red-200'
                    : alert.type === 'warning'
                    ? 'bg-yellow-50 border border-yellow-200'
                    : 'bg-blue-50 border border-blue-200'
                }`}
              >
                <AlertCircle
                  className={`w-5 h-5 mt-0.5 ${
                    alert.type === 'error'
                      ? 'text-red-600'
                      : alert.type === 'warning'
                      ? 'text-yellow-600'
                      : 'text-blue-600'
                  }`}
                />
                <div className="flex-1">
                  <div className="text-[#1E1E1E]">{alert.message}</div>
                  <div className="text-gray-600 text-sm mt-1">Ruleset: {alert.ruleset}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
