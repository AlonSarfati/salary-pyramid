import { useState, useEffect, createContext, useContext } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import {
  Home,
  PlayCircle,
  Settings,
  BarChart3,
  Shield,
  Users,
  Network,
  TrendingUp,
} from "lucide-react";
import HomePage from "./components/HomePage";
import SimulateSingle from "./components/SimulateSingle";
import SimulateBulk from "./components/SimulateBulk";
import RuleBuilder from "./components/RuleBuilder";
import TableBuilder from "./components/TableBuilder";
import ComponentGroups from "./components/ComponentGroups";
import ComponentsGraph from "./components/ComponentsGraph";
import ResultsPage from "./components/ResultsPage";
import AdminPage from "./components/AdminPage";
import EmployeeManager from "./components/EmployeeManager";
import GlobalPayrollDashboard from "./components/GlobalPayrollDashboard";
import Optimizer from "./components/Optimizer";
import RulesLayout from "./components/RulesLayout";
import SimulateLayout from "./components/SimulateLayout";
import AccessDenied from "./components/AccessDenied";
import AuthCallback from "./components/AuthCallback";
import UserMenu from "./components/UserMenu";
import UserInfo from "./components/UserInfo";
import UserSettings from "./components/UserSettings";
import AdminUsersPage from "./components/AdminUsersPage";
import AdminTenantPage from "./components/AdminTenantPage";
import AdminTenantsPage from "./components/AdminTenantsPage";
import AdminGlobalUsersPage from "./components/AdminGlobalUsersPage";
import { tenantApi, authApi } from "./services/apiService";
import { setAuthData, setAuthToken, getAuthData } from "./services/authService";
import { getCurrentUser, getUserManager } from "./oidc/oidcClient";
import { ToastProvider } from "./components/ToastProvider";

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
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<{ error: string; message: string } | null>(null);

  // Check authentication status on mount (except for callback route)
  useEffect(() => {
    if (location.pathname === "/auth/callback") {
      return;
    }

    // Set up token refresh interval to check and refresh tokens before they expire
    const setupTokenRefresh = () => {
      const userManager = getUserManager();
      
      // Listen for token expiration and auto-renew
      userManager.events.addUserLoaded((user) => {
        if (import.meta.env.DEV) {
          console.info("OIDC: User loaded, token expires in", 
            Math.floor((user.expires_at || 0) - Date.now() / 1000), "seconds");
        }
        // Update token in authService
        if (user.access_token) {
          setAuthToken(user.access_token);
        }
      });
      
      userManager.events.addAccessTokenExpiring(() => {
        if (import.meta.env.DEV) {
          console.info("OIDC: Access token expiring soon, renewing...");
        }
        // The automaticSilentRenew will handle this, but we can also manually trigger
        userManager.signinSilent().catch(err => {
          console.warn("OIDC: Failed to silently renew token:", err);
        });
      });
      
      userManager.events.addAccessTokenExpired(() => {
        if (import.meta.env.DEV) {
          console.warn("OIDC: Access token expired");
        }
        // Try to renew
        userManager.signinSilent().catch(err => {
          console.warn("OIDC: Failed to renew expired token:", err);
        });
      });
    };

    (async () => {
      try {
        setAuthLoading(true);
        setAuthError(null);

        // Set up token refresh listeners
        setupTokenRefresh();

        // 1) Try to load existing OIDC user session
        const user = await getCurrentUser();

        if (import.meta.env.DEV) {
          console.info(
            "OIDC getCurrentUser: user loaded?",
            !!user,
            "access_token?",
            !!user?.access_token
          );
        }

        if (!user || !user.access_token) {
          setAuthError({
            error: "NOT_AUTHENTICATED",
            message:
              "You are not logged in. Please sign in to access the simulator.",
          });
          return;
        }

        // 2) Set token for API calls (ensure in-memory token is set on refresh)
        setAuthToken(user.access_token);
        if (import.meta.env.DEV) {
          console.info(
            "Auth token set from OIDC user:",
            !!user.access_token
          );
        }

        // 3) Check backend auth/me to get role/mode/tenants
        try {
          if (import.meta.env.DEV) {
            console.info("Calling /api/auth/me...");
          }
          const authData = await authApi.getMe();
          if (import.meta.env.DEV) {
            console.info("✅ /api/auth/me succeeded:", authData);
          }
          setAuthData(authData);
        } catch (error: any) {
          if (import.meta.env.DEV) {
            console.error("❌ /api/auth/me failed:", error);
          }
          if (error.status === 401 || error.error === "NOT_AUTHENTICATED") {
            setAuthError({
              error: "NOT_AUTHENTICATED",
              message:
                "You are not logged in. Please sign in to access the simulator.",
            });
            return;
          }

          if (error.error === "ACCESS_DENIED" || error.error === "ACCOUNT_DISABLED") {
            const errorData =
              error.error === "ACCESS_DENIED"
                ? {
                    error: "ACCESS_DENIED",
                    message: "Your account is not approved yet.",
                  }
                : {
                    error: "ACCOUNT_DISABLED",
                    message: "Your account has been disabled.",
                  };
            setAuthError(errorData);
            return;
          }

          console.log("Auth check failed (OIDC may not be configured):", error);
        }

        // 4) Load tenants and filter by user's allowed tenants
        const allTenants = await tenantApi.list();
        
        // Get current auth data (might have been set in step 3)
        const currentAuthData = getAuthData();
        
        // Filter tenants based on user's allowedTenantIds
        let filteredTenants = allTenants;
        if (currentAuthData?.allowedTenantIds && currentAuthData.allowedTenantIds.length > 0) {
          filteredTenants = allTenants.filter(tenant => 
            currentAuthData.allowedTenantIds.includes(tenant.tenantId)
          );
        }
        
        setTenants(filteredTenants);

        // Set default tenant from filtered list
        if (filteredTenants.length > 0) {
          const currentAuthData = getAuthData();
          const defaultTenant = filteredTenants.find((t) => t.tenantId === "default");
          const firstActive = filteredTenants.find((t) => t.status === "ACTIVE");
          if (currentAuthData?.primaryTenantId && filteredTenants.some(t => t.tenantId === currentAuthData.primaryTenantId)) {
            setSelectedTenantId(currentAuthData.primaryTenantId);
          } else if (defaultTenant) {
            setSelectedTenantId("default");
          } else if (firstActive) {
            setSelectedTenantId(firstActive.tenantId);
          } else {
            setSelectedTenantId(filteredTenants[0].tenantId);
          }
        }
      } catch (error: any) {
        console.error("Failed to load tenants:", error);
        if (error.error === "ACCESS_DENIED" || error.error === "ACCOUNT_DISABLED") {
          const errorData =
            error.error === "ACCESS_DENIED"
              ? { error: "ACCESS_DENIED", message: "Your account is not approved yet." }
              : {
                  error: "ACCOUNT_DISABLED",
                  message: "Your account has been disabled.",
                };
          setAuthError(errorData);
        }
      } finally {
        setAuthLoading(false);
        setTenantsLoading(false);
      }
    })();
  }, [location.pathname]);

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

  const reloadTenants = async () => {
    try {
      const allTenants = await tenantApi.list();
      const currentAuthData = getAuthData();
      
      // Filter tenants based on user's allowedTenantIds
      let filteredTenants = allTenants;
      if (currentAuthData?.allowedTenantIds && currentAuthData.allowedTenantIds.length > 0) {
        filteredTenants = allTenants.filter(tenant => 
          currentAuthData.allowedTenantIds.includes(tenant.tenantId)
        );
      }
      
      setTenants(filteredTenants);
    } catch (error) {
      console.error("Failed to reload tenants:", error);
    }
  };

  // Show access denied screen if auth check failed
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#EEF2F8] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-[#0052CC] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (authError) {
    return <AccessDenied error={authError.error} message={authError.message} />;
  }

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
          <div className="p-6 border-b border-gray-200 flex items-center">
            <img
              src="/assets/icons/lira-logo-rev.png"
              alt="Lira logo"
              className="sidebar-logo w-auto"
            />
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
              {!tenantsLoading && tenants.length > 0 && (() => {
                const authData = getAuthData();
                const isMultiTenant = authData?.mode === "MULTI_TENANT" || 
                                     (authData?.allowedTenantIds && authData.allowedTenantIds.length > 1);
                
                if (isMultiTenant) {
                  // Show dropdown for multi-tenant
                  return (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Tenant:</span>
                      <select
                        value={selectedTenantId}
                        onChange={(e) => setSelectedTenantId(e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded bg-white text-[#1E1E1E] min-w-[200px] text-sm"
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
                  );
                } else {
                  // Show static text for single-tenant
                  const primaryTenant = tenants.find(t => t.tenantId === authData?.primaryTenantId) ||
                                      tenants.find(t => t.tenantId === "default") ||
                                      tenants[0];
                  const tenantName = primaryTenant?.name || primaryTenant?.tenantId || "Default";
                  
                  return (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Tenant:</span>
                      <span className="text-sm text-[#1E1E1E] font-medium">{tenantName}</span>
                    </div>
                  );
                }
              })()}
              <UserMenu />
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
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route
          path="/*"
          element={
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
                <Route path="/admin/users" element={<AdminUsersPage />} />
                <Route path="/admin/tenant" element={<AdminTenantPage />} />
                <Route path="/admin/tenants" element={<AdminTenantsPage />} />
                <Route path="/admin/global-users" element={<AdminGlobalUsersPage />} />
                <Route path="/user/info" element={<UserInfo />} />
                <Route path="/user/settings" element={<UserSettings />} />
              </Routes>
            </AppLayout>
          }
        />
      </Routes>
    </ToastProvider>
  );
}
