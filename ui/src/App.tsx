import { useState, useEffect } from 'react';
import { Home, PlayCircle, Settings, BarChart3, Shield, Users, Network, HelpCircle, TrendingUp } from 'lucide-react';
import HomePage from './components/HomePage';
import SimulateSingle from './components/SimulateSingle';
import SimulateBulk from './components/SimulateBulk';
import RuleBuilder from './components/RuleBuilder';
import ComponentsGraph from './components/ComponentsGraph';
import ResultsPage from './components/ResultsPage';
import AdminPage from './components/AdminPage';
import EmployeeManager from './components/EmployeeManager';
import GlobalPayrollDashboard from './components/GlobalPayrollDashboard';
import Optimizer from './components/Optimizer';
import { tenantApi } from './services/apiService';
import { ToastProvider } from './components/ToastProvider';

type Page = 'home' | 'simulate-single' | 'simulate-bulk' | 'rule-builder' | 'visual' | 'results' | 'admin' | 'employees' | 'dashboard' | 'optimizer';

type Tenant = {
  tenantId: string;
  name: string;
  status: string;
  currency: string;
  createdAt: string;
  updatedAt: string;
};

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('default');
  const [tenantsLoading, setTenantsLoading] = useState(true);

  // Fetch tenants on mount
  useEffect(() => {
    (async () => {
      try {
        const data = await tenantApi.list();
        setTenants(data);
        // If default tenant exists, select it; otherwise select first active tenant
        const defaultTenant = data.find(t => t.tenantId === 'default');
        const firstActive = data.find(t => t.status === 'ACTIVE');
        if (defaultTenant) {
          setSelectedTenantId('default');
        } else if (firstActive) {
          setSelectedTenantId(firstActive.tenantId);
        } else if (data.length > 0) {
          setSelectedTenantId(data[0].tenantId);
        }
      } catch (error) {
        console.error('Failed to load tenants:', error);
      } finally {
        setTenantsLoading(false);
      }
    })();
  }, []);

  const navItems = [
    { id: 'home' as Page, icon: Home, label: 'Home' },
    { id: 'dashboard' as Page, icon: BarChart3, label: 'Dashboard' },
    { id: 'simulate-single' as Page, icon: PlayCircle, label: 'Simulate' },
    { id: 'optimizer' as Page, icon: TrendingUp, label: 'Optimizer' },
    { id: 'employees' as Page, icon: Users, label: 'Employees' },
    { id: 'rule-builder' as Page, icon: Settings, label: 'Rules' },
    { id: 'visual' as Page, icon: Network, label: 'Visual' },
    { id: 'results' as Page, icon: BarChart3, label: 'Results' },
    { id: 'admin' as Page, icon: Shield, label: 'Admin' },
  ];

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <HomePage onNavigate={setCurrentPage} />;
      case 'simulate-single':
        return <SimulateSingle tenantId={selectedTenantId} />;
      case 'simulate-bulk':
        return <SimulateBulk tenantId={selectedTenantId} />;
      case 'optimizer':
        return <Optimizer tenantId={selectedTenantId} />;
      case 'rule-builder':
        return <RuleBuilder tenantId={selectedTenantId} />;
      case 'visual':
        return <ComponentsGraph tenantId={selectedTenantId} />;
      case 'results':
        return <ResultsPage tenantId={selectedTenantId} onNavigate={setCurrentPage} />;
      case 'dashboard':
        return <GlobalPayrollDashboard tenantId={selectedTenantId} />;
      case 'employees':
        return <EmployeeManager tenantId={selectedTenantId} />;
      case 'admin':
        return <AdminPage onTenantChange={() => {
          // Reload tenants when admin makes changes
          tenantApi.list().then(setTenants).catch(console.error);
        }} />;
      default:
        return <HomePage onNavigate={setCurrentPage} />;
    }
  };

  return (
    <ToastProvider>
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
              {!tenantsLoading && tenants.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Tenant:</span>
                  <select
                    value={selectedTenantId}
                    onChange={(e) => setSelectedTenantId(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-[#1E1E1E] min-w-[200px]"
                  >
                    {tenants
                      .filter(t => t.status === 'ACTIVE')
                      .map((tenant) => (
                        <option key={tenant.tenantId} value={tenant.tenantId}>
                          {tenant.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}
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
    </ToastProvider>
  );
}
