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
import TenantAdminLayout from "./components/TenantAdminLayout";
import SystemAdminLayout from "./components/SystemAdminLayout";
import AdminTenantsPage from "./components/AdminTenantsPage";
import AdminUsersPage from "./components/AdminUsersPage";
import AdminRolesPage from "./components/AdminRolesPage";
import AdminIntegrationsPage from "./components/AdminIntegrationsPage";
import AdminAuditPage from "./components/AdminAuditPage";
import AdminTenantMembersPage from "./components/AdminTenantMembersPage";
import AdminTenantSettingsPage from "./components/AdminTenantSettingsPage";
import { tenantApi, authApi } from "./services/apiService";
import { setAuthData, setAuthToken, getAuthData } from "./services/authService";
import { getCurrentUser, getUserManager } from "./oidc/oidcClient";
import { ToastProvider } from "./components/ToastProvider";

type Tenant = {
  tenantId: string;
  tenantName: string;
  name?: string; // Legacy field for backwards compatibility
  status: string;
  currency: string;
  createdAt: string;
  updatedAt: string;
  effectiveRole?: string;
  roleSource?: 'SYSTEM_ALLOWLIST' | 'TENANT_MEMBERSHIP';
  canAccessAllTenants?: boolean;
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

    (async () => {
      try {
        setAuthLoading(true);
        setAuthError(null);

        // Check if OIDC is configured
        const { isOidcConfigured } = await import("./oidc/oidcClient");
        const oidcConfigured = isOidcConfigured();
        let oidcEnabled = false;

        if (oidcConfigured) {
          // OIDC is configured - try to use it, but fall back to no-auth if Keycloak is unavailable
          try {
            const { getUserManager, getCurrentUser } = await import("./oidc/oidcClient");
            
            // Set up token refresh interval to check and refresh tokens before they expire
            const setupTokenRefresh = () => {
              const userManager = getUserManager();
              if (!userManager) return;
              
              // Listen for token expiration and auto-renew
              userManager.events.addUserLoaded((user) => {
                // Update token in authService when user is loaded/renewed
                if (user.access_token) {
                  setAuthToken(user.access_token);
                }
              });
              
              userManager.events.addAccessTokenExpiring(() => {
                // The automaticSilentRenew will handle this, but we can also manually trigger
                userManager.signinSilent().catch(() => {
                  // Silent renewal failed - will be handled by automaticSilentRenew
                });
              });
              
              userManager.events.addAccessTokenExpired(() => {
                // Try to renew expired token
                userManager.signinSilent().catch(() => {
                  // Renewal failed - user may need to sign in again
                });
              });
            };

            // First, check if backend is in permit-all mode by trying to call an API without auth
            // This avoids trying to use OIDC if backend doesn't require it
            try {
              await tenantApi.list();
              // If this succeeds without auth, backend is in permit-all mode - skip OIDC
              console.info("Backend appears to be in permit-all mode. Skipping OIDC authentication.");
              oidcEnabled = false;
            } catch (e: any) {
              // If this fails with 401/403, backend requires auth - try OIDC
              if (e.status === 401 || e.status === 403) {
                // Backend requires auth - set up OIDC
                setupTokenRefresh();

                // Try to load existing OIDC user session
                const user = await getCurrentUser();

                if (user && user.access_token) {
                  // OIDC is working - use it
                  oidcEnabled = true;
                  setAuthToken(user.access_token);
                } else {
                  // No user session - OIDC is needed but user not logged in
                  oidcEnabled = true;
                  setAuthError({
                    error: "NOT_AUTHENTICATED",
                    message:
                      "You are not logged in. Please sign in to access the simulator.",
                  });
                  return;
                }
              } else {
                // Other error - assume permit-all mode
                console.info("API call failed with non-auth error. Assuming permit-all mode.");
                oidcEnabled = false;
              }
            }
          } catch (e: any) {
            // OIDC connection failed (e.g., Keycloak not running) - fall back to no-auth
            console.info("OIDC configured but connection failed (Keycloak may not be running). Falling back to no-auth mode.");
            oidcEnabled = false;
          }
        } else {
          // OIDC not configured - use no-auth mode
          console.info("OIDC not configured. Running in no-auth mode (backend permit-all)");
        }

        // 3) Check backend auth/me to get role/mode/tenants
        if (oidcEnabled && oidcConfigured) {
          // OIDC mode: call /api/auth/me to get user info
          try {
            const authData = await authApi.getMe();
            setAuthData(authData);
          } catch (error: any) {
            // Handle auth errors
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
          }
        } else {
          // No-OIDC mode (permit-all): create default auth data
          // /api/auth/me requires JWT, so skip it in permit-all mode
          console.info("Backend in permit-all mode, using default auth data");
          setAuthData({
            userIdentity: {
              issuer: "local",
              subject: "local-user",
              email: "local@example.com",
              displayName: "Local User",
            },
            role: "SYSTEM_ADMIN",
            mode: "MULTI_TENANT",
            allowedTenantIds: [],
          });
        }

        // 4) Load tenants (backend now filters based on user's access)
        const allTenants = await tenantApi.list();
        
        // Normalize tenant data (handle both tenantName and name fields)
        const normalizedTenants = allTenants.map(t => ({
          ...t,
          name: t.tenantName || t.name || t.tenantId, // Use tenantName if available, fallback to name or tenantId
        }));
        
        setTenants(normalizedTenants);

        // Set default tenant from list
        if (normalizedTenants.length > 0) {
          const currentAuthData = getAuthData();
          const defaultTenant = normalizedTenants.find((t) => t.tenantId === "default");
          const firstActive = normalizedTenants.find((t) => t.status === "ACTIVE");
          if (currentAuthData?.primaryTenantId && normalizedTenants.some(t => t.tenantId === currentAuthData.primaryTenantId)) {
            setSelectedTenantId(currentAuthData.primaryTenantId);
          } else if (defaultTenant) {
            setSelectedTenantId("default");
          } else if (firstActive) {
            setSelectedTenantId(firstActive.tenantId);
          } else {
            setSelectedTenantId(normalizedTenants[0].tenantId);
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
    // Special handling for /admin - only match tenant admin pages
    if (path === '/admin') {
      const tenantAdminPaths = ['/admin/tenant-members', '/admin/tenant-settings'];
      return location.pathname === '/admin' || tenantAdminPaths.some(p => location.pathname.startsWith(p));
    }
    return location.pathname.startsWith(path);
  };

  const reloadTenants = async () => {
    try {
      const allTenants = await tenantApi.list();
      
      // Normalize tenant data (handle both tenantName and name fields)
      const normalizedTenants = allTenants.map(t => ({
        ...t,
        name: t.tenantName || t.name || t.tenantId, // Use tenantName if available, fallback to name or tenantId
      }));
      
      setTenants(normalizedTenants);
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
      <div 
        className="flex h-screen"
        style={{
          background: "linear-gradient(90deg, #E7EDF1 0%, #DDE9EC 45%, #CFE7E5 100%)",
        }}
      >
{/* Left Sidebar */}
<div
  className="flex flex-col"
  style={{
    width: 180,
    background: "linear-gradient(180deg, #1A5F7A 0%, #155A73 45%, #0F4A5C 100%)",
  }}
>
  <div className="px-6 py-6 flex items-center justify-center">
    <img
      src="/assets/icons/blaa.png"
      alt="Lira logo"
      className="w-[120px] h-auto opacity-95"
    />
  </div>

  <nav className="flex-1 px-3">
    {navItems.map((item) => {
      const active = isActive(item.path);

      return (
          <Link
            key={item.path}
            to={item.path}
            className="relative w-full flex items-center gap-3 px-4 py-3 mb-2 rounded-md transition-all"
            style={{
              color: "#FFFFFF",
              background: active
                ? "rgba(71, 215, 215, 0.18)" // ירקרק־כחול כמו בתמונה
                : "transparent",
            }}
          >
          <span
            className="absolute left-0 top-0 h-full rounded-r"
            style={{
              width: 4,
              background: active ? "#47D7D7" : "transparent",
            }}
          />
          <item.icon className="w-5 h-5 shrink-0" />
          <span className="text-[14px] font-medium">{item.label}</span>
        </Link>
      );
    })}
  </nav>

  <div className="h-8" />
</div>

        {/* Main Content */}
        <div 
          className="flex-1 flex flex-col overflow-hidden"
          style={{
            background: "linear-gradient(90deg, #E7EDF1 0%, #DDE9EC 45%, #CFE7E5 100%)",
          }}
        >
          {/* Top Bar */}
          <div 
            className="px-6 py-4 flex items-center justify-between border-b"
            style={{
              background: "#FFFFFF",
              borderColor: "#E5E7EB",
            }}
          >
            <h2 className="text-gray-800 font-semibold">Lira Compensation Simulator</h2>
            <div className="flex items-center gap-4">
              {!tenantsLoading && tenants.length > 0 && (() => {
                const authData = getAuthData();
                // Check if user has multiple tenants or is in MULTI_TENANT mode
                const isMultiTenant = authData?.mode === "MULTI_TENANT" || 
                                     (tenants.length > 1) ||
                                     (tenants.some(t => t.canAccessAllTenants));
                
                if (isMultiTenant && tenants.length > 1) {
                  // Show dropdown for multi-tenant
                  return (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Tenant:</span>
                      <select
                        value={selectedTenantId}
                        onChange={(e) => setSelectedTenantId(e.target.value)}
                        className="px-4 py-2 border rounded-sm min-w-[200px] text-sm focus:outline-none focus:ring-2 focus:ring-[#47D7D7] bg-white"
                        style={{
                          borderColor: "#D1D5DB",
                          color: "#1F2937",
                        }}
                      >
                        {tenants
                          .filter(t => t.status === 'ACTIVE')
                          .map((tenant) => (
                            <option key={tenant.tenantId} value={tenant.tenantId}>
                              {tenant.name || tenant.tenantName || tenant.tenantId}
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
                  const tenantName = primaryTenant?.name || primaryTenant?.tenantName || primaryTenant?.tenantId || "Default";
                  
                  return (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Tenant:</span>
                      <span className="text-sm text-gray-800 font-medium">{tenantName}</span>
                    </div>
                  );
                }
              })()}
              <UserMenu />
            </div>
          </div>

          {/* Page Content */}
          <div 
            className="flex-1 overflow-auto"
            style={{
              background: "linear-gradient(90deg, #E7EDF1 0%, #DDE9EC 45%, #CFE7E5 100%)",
            }}
          >
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

// Admin routes are handled by AdminLayout with nested routes

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
                
                {/* Tenant Admin Section - Sidebar "Admin" tab */}
                <Route path="/admin" element={<TenantAdminLayout />}>
                  <Route index element={<AdminTenantMembersPage />} />
                  <Route path="tenant-members" element={<AdminTenantMembersPage />} />
                  <Route path="tenant-settings" element={<AdminTenantSettingsPage />} />
                </Route>
                
                {/* System Admin Section - User menu only */}
                <Route path="/system" element={<SystemAdminLayout />}>
                  <Route index element={<AdminTenantsPage />} />
                  <Route path="tenants" element={<AdminTenantsPage />} />
                  <Route path="users" element={<AdminUsersPage />} />
                  <Route path="roles" element={<AdminRolesPage />} />
                  <Route path="integrations" element={<AdminIntegrationsPage />} />
                  <Route path="audit" element={<AdminAuditPage />} />
                </Route>
                
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
