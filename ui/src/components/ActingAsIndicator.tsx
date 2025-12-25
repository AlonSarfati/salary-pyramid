import { Badge } from "./ui/badge";
import { getAuthData } from "../services/authService";
import { useTenant } from "../App";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { Info } from "lucide-react";

export default function ActingAsIndicator() {
  const authData = getAuthData();
  const { tenantId, tenants } = useTenant();

  if (!authData) {
    return null;
  }

  // Normalize role names
  const normalizeRole = (role: string | undefined): string => {
    if (!role) return "VIEWER";
    switch (role) {
      case "ADMIN":
        return "SYSTEM_ADMIN";
      case "ANALYST":
        return "SYSTEM_ANALYST";
      case "VIEWER":
        return "SYSTEM_VIEWER";
      default:
        return role;
    }
  };

  const role = normalizeRole(authData.role);
  const isSystemAdmin = role === "SYSTEM_ADMIN" || role === "ADMIN";
  const canAccessAllTenants = isSystemAdmin || authData.mode === "MULTI_TENANT";
  
  // Determine role source (we'll need to get this from tenant metadata or enhance auth response)
  // For now, infer from role type
  const roleSource = role.startsWith("SYSTEM_") ? "System allowlist" : "Tenant membership";
  
  // Get current tenant name
  const currentTenant = tenants.find(t => t.tenantId === tenantId);
  const tenantName = currentTenant?.name || currentTenant?.tenantName || tenantId;

  // Determine scope
  let scopeText: string;
  if (canAccessAllTenants && isSystemAdmin) {
    scopeText = "All tenants";
  } else if (tenantId && currentTenant) {
    scopeText = `Tenant: ${tenantName} (${tenantId})`;
  } else {
    scopeText = "Select a tenant";
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-gray-500">Acting as:</span>
        <Badge variant="outline" className="rounded-sm text-xs font-medium">
          {role.replace("SYSTEM_", "").replace("TENANT_", "")}
        </Badge>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-gray-500">Scope:</span>
        {scopeText === "Select a tenant" ? (
          <Badge variant="destructive" className="rounded-sm text-xs">
            {scopeText}
          </Badge>
        ) : (
          <Badge variant="outline" className="rounded-sm text-xs">
            {scopeText}
          </Badge>
        )}
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 cursor-help">
            <span className="text-xs text-gray-500">Granted by:</span>
            <Badge variant="outline" className="rounded-sm text-xs">
              {roleSource}
            </Badge>
            <Info className="w-3 h-3 text-gray-400" />
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="text-xs">
            {roleSource === "System allowlist" 
              ? "Your access is granted through the system-level allowlist."
              : "Your access is granted through tenant membership."}
          </p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

