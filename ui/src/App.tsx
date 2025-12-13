import { useState, useEffect, createContext, useContext } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, PlayCircle, Settings, BarChart3, Shield, Users, Network, HelpCircle, TrendingUp } from 'lucide-react';
import HomePage from './components/HomePage';
import SimulateSingle from './components/SimulateSingle';
import SimulateBulk from './components/SimulateBulk';
import RuleBuilder from './components/RuleBuilder';
import TableBuilder from './components/TableBuilder';
import ComponentGroups from './components/ComponentGroups';
import ComponentsGraph from './components/ComponentsGraph';
import ResultsPage from './components/ResultsPage';
import AdminPage from './components/AdminPage';
import EmployeeManager from './components/EmployeeManager';
import GlobalPayrollDashboard from './components/GlobalPayrollDashboard';
import Optimizer from './components/Optimizer';
import RulesLayout from './components/RulesLayout';
import SimulateLayout from './components/SimulateLayout';
import { tenantApi } from './services/apiService';
import { ToastProvider } from './components/ToastProvider';
import liraLogo from './assets/lira-logo.png';

type Tenant = {
  tenantId: string;
  name: string;
  status: string;
  currency: string;
  createdAt: string;
  updatedAt: string;
};

type TenantContextType = {
  tenantId: string;
  tenants: Tenant[];
  setTenantId: (id: string) => void;
  reloadTenants: () => void;
};

const TenantContext = createContext<TenantContextType>({
  tenantId: 'default',
  tenants: [],
  setTenantId: () => {},
  reloadTenants: () => {},
});

export const useTenant = () => useContext(TenantContext);

function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
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
    { path: '/', icon: Home, label: 'Home' },
    { path: '/dashboard', icon: BarChart3, label: 'Dashboard' },
    { path: '/simulate', icon: PlayCircle, label: 'Simulate' },
    { path: '/optimizer', icon: TrendingUp, label: 'Optimizer' },
    { path: '/employees', icon: Users, label: 'Employees' },
    { path: '/rules', icon: Settings, label: 'Rules' },
    { path: '/visual', icon: Network, label: 'Visual' },
    { path: '/results', icon: BarChart3, label: 'Results' },
    { path: '/admin', icon: Shield, label: 'Admin' },
  ];

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const reloadTenants = () => {
    tenantApi.list().then(setTenants).catch(console.error);
  };

  return (
    <TenantContext.Provider value={{
      tenantId: selectedTenantId,
      tenants,
      setTenantId: setSelectedTenantId,
      reloadTenants,
    }}>
      <div className="flex h-screen bg-[#EEF2F8]">
        {/* Left Sidebar */}
        <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <img src={liraLogo} alt="Lira Logo" className="h-8 w-auto" />
              <h1 className="text-[#0052CC]">Lira Compensation</h1>
            </div>
          </div>
          <nav className="flex-1 p-4">
            {navItems.map((item) => {
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-colors ${
                    active
                      ? 'bg-[#0052CC] text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top Bar */}
          <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <h2 className="text-[#1E1E1E]">Lira Compensation Simulator</h2>
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
            {children}
          </div>
        </div>
      </div>
    </TenantContext.Provider>
  );
}

// Route components that need tenantId
function DashboardRoute() {
  const { tenantId } = useTenant();
  return <GlobalPayrollDashboard tenantId={tenantId} />;
}

function SimulateSingleRoute() {
  const { tenantId } = useTenant();
  return <SimulateSingle tenantId={tenantId} />;
}

function SimulateBulkRoute() {
  const { tenantId } = useTenant();
  return <SimulateBulk tenantId={tenantId} />;
}

function OptimizerRoute() {
  const { tenantId } = useTenant();
  return <Optimizer tenantId={tenantId} />;
}

function EmployeesRoute() {
  const { tenantId } = useTenant();
  return <EmployeeManager tenantId={tenantId} />;
}

function RuleBuilderRoute() {
  const { tenantId } = useTenant();
  return <RuleBuilder tenantId={tenantId} />;
}

function TableBuilderRoute() {
  const { tenantId } = useTenant();
  return <TableBuilder tenantId={tenantId} />;
}

function ComponentGroupsRoute() {
  const { tenantId } = useTenant();
  return <ComponentGroups tenantId={tenantId} />;
}

function VisualRoute() {
  const { tenantId } = useTenant();
  return <ComponentsGraph tenantId={tenantId} />;
}

function ResultsRoute() {
  const { tenantId, reloadTenants } = useTenant();
  return <ResultsPage tenantId={tenantId} />;
}

function AdminRoute() {
  const { reloadTenants } = useTenant();
  return <AdminPage onTenantChange={reloadTenants} />;
}

export default function App() {
  return (
    <ToastProvider>
      <AppLayout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/dashboard" element={<DashboardRoute />} />
          <Route path="/simulate" element={<SimulateLayout />}>
            <Route index element={<SimulateSingleRoute />} />
            <Route path="single" element={<SimulateSingleRoute />} />
            <Route path="bulk" element={<SimulateBulkRoute />} />
          </Route>
          <Route path="/optimizer" element={<OptimizerRoute />} />
          <Route path="/employees" element={<EmployeesRoute />} />
          <Route path="/rules" element={<RulesLayout />}>
            <Route index element={<RuleBuilderRoute />} />
            <Route path="builder" element={<RuleBuilderRoute />} />
            <Route path="tables" element={<TableBuilderRoute />} />
            <Route path="groups" element={<ComponentGroupsRoute />} />
          </Route>
          <Route path="/visual" element={<VisualRoute />} />
          <Route path="/results" element={<ResultsRoute />} />
          <Route path="/admin" element={<AdminRoute />} />
        </Routes>
      </AppLayout>
    </ToastProvider>
  );
}
