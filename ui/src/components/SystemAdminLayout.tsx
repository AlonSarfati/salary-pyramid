import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Building2, Users, Shield, Plug, FileText } from "lucide-react";
import { cn } from "./ui/utils";
import ActingAsIndicator from "./ActingAsIndicator";
import { Badge } from "./ui/badge";

const tabs = [
  { id: "tenants", label: "Tenants", icon: Building2, path: "/system/tenants" },
  { id: "users", label: "Users", icon: Users, path: "/system/users" },
  { id: "roles", label: "Roles & Permissions", icon: Shield, path: "/system/roles" },
  { id: "integrations", label: "Integrations", icon: Plug, path: "/system/integrations" },
  { id: "audit", label: "Audit Log", icon: FileText, path: "/system/audit" },
];

export default function SystemAdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentTab = tabs.find(tab => location.pathname.startsWith(tab.path))?.id || "tenants";

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h1 className="text-2xl font-semibold text-[#1E1E1E] mb-1">System Administration</h1>
            <p className="text-sm text-gray-600">Manage system-wide settings, tenants, and users</p>
          </div>
          <Badge variant="outline" className="rounded-sm">
            System-level
          </Badge>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-200">
          <ActingAsIndicator />
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-1" aria-label="System admin tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => navigate(tab.path)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors rounded-t-sm",
                  isActive
                    ? "border-[#0052CC] text-[#0052CC] bg-blue-50"
                    : "border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300"
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <Outlet />
    </div>
  );
}

