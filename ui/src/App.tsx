import { useState } from 'react';
import { Home, PlayCircle, Settings, BarChart3, Shield } from 'lucide-react';
import HomePage from './components/HomePage';
import SimulateSingle from './components/SimulateSingle';
import SimulateBulk from './components/SimulateBulk';
import RuleBuilder from './components/RuleBuilder';
import ComponentsGraph from './components/ComponentsGraph';
import ResultsPage from './components/ResultsPage';
import AdminPage from './components/AdminPage';
import SimulateHookup from './components/SimulateHookup';


type Page = 'home' | 'simulate-single' | 'simulate-bulk' | 'rule-builder' | 'components-graph' | 'results' | 'admin';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [tenant, setTenant] = useState('Acme Corp');

  const navItems = [
    { id: 'home' as Page, icon: Home, label: 'Home' },
    { id: 'simulate-single' as Page, icon: PlayCircle, label: 'Simulate' },
    { id: 'rule-builder' as Page, icon: Settings, label: 'Rules' },
    { id: 'results' as Page, icon: BarChart3, label: 'Results' },
    { id: 'admin' as Page, icon: Shield, label: 'Admin' },
  ];

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <HomePage onNavigate={setCurrentPage} />;
      case 'simulate-single':
        return <SimulateSingle />;
      case 'simulate-bulk':
        return <SimulateBulk />;
      case 'rule-builder':
        return <RuleBuilder />;
      case 'components-graph':
        return <ComponentsGraph />;
      case 'results':
        return <ResultsPage />;
      case 'admin':
        return <AdminPage />;
      case 'simulate-hookup':
        return <SimulateHookup />;
      default:
        return <HomePage onNavigate={setCurrentPage} />;
    }
  };

  return (
    <div className="flex h-screen bg-[#EEF2F8]">
      {/* Left Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-[#0052CC]">Atlas Compensation</h1>
        </div>
        <nav className="flex-1 p-4">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-colors ${
                currentPage === item.id
                  ? 'bg-[#0052CC] text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-[#1E1E1E]">Atlas Compensation Simulator</h2>
          <div className="flex items-center gap-4">
            <select
              value={tenant}
              onChange={(e) => setTenant(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-[#1E1E1E]"
            >
              <option>Acme Corp</option>
              <option>TechStart Inc</option>
              <option>Global Enterprises</option>
            </select>
            <div className="w-10 h-10 rounded-full bg-[#0052CC] flex items-center justify-center text-white">
              JD
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1 overflow-auto">
          {renderPage()}
        </div>
      </div>
    </div>
  );
}
