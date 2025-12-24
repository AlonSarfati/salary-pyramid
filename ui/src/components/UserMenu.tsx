import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Users, Building2, Shield } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { getAuthData, clearAuthToken } from "../services/authService";
import { getUserManager } from "../oidc/oidcClient";

export default function UserMenu() {
  const navigate = useNavigate();
  const authData = getAuthData();
  const [open, setOpen] = useState(false);

  const displayName = authData?.userIdentity?.displayName || 
                     authData?.userIdentity?.email?.split("@")[0] || 
                     "User";
  const email = authData?.userIdentity?.email || "";
  const role = authData?.role || "";
  
  // Capability checks
  const isAdmin = role === "ADMIN";
  const isSysAdmin = role === "SYS_ADMIN" || role === "SUPER_ADMIN";
  
  // Get role label
  const getRoleLabel = (role: string) => {
    switch (role) {
      case "ADMIN":
        return "Admin";
      case "ANALYST":
        return "User";
      case "VIEWER":
        return "Viewer";
      default:
        return "User";
    }
  };
  
  // Get initials for avatar
  const getInitials = (name: string) => {
    if (!name) return "U";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const handleSignOut = async () => {
    try {
      const userManager = getUserManager();
      if (userManager) {
        clearAuthToken();
        await userManager.signoutRedirect();
      } else {
        clearAuthToken();
        window.location.href = "/";
      }
    } catch (error) {
      console.error("Sign out error:", error);
      clearAuthToken();
      window.location.href = "/";
    }
  };

  const handleNavigation = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-[#0052CC] focus:ring-offset-2">
          <div className="w-10 h-10 rounded-full bg-[#0052CC] flex items-center justify-center text-white text-sm font-semibold shrink-0">
            {getInitials(displayName)}
          </div>
          <div className="hidden md:flex flex-col items-start">
            <span className="text-sm font-medium text-[#1E1E1E] leading-tight">
              {displayName.length > 20 ? displayName.substring(0, 20) + "..." : displayName}
            </span>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 rounded-sm">
        {/* Header - not clickable */}
        <div className="px-3 py-2.5 border-b border-gray-200 pointer-events-none">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-[#1E1E1E]">{displayName}</span>
            {email && (
              <span className="text-xs text-gray-500 mt-0.5">{email}</span>
            )}
            {role && (
              <span className="text-xs text-gray-400 mt-1 uppercase tracking-wide">
                {getRoleLabel(role)}
              </span>
            )}
          </div>
        </div>

        {/* System Admin Section */}
        {isSysAdmin && (
          <>
            <div className="px-3 py-1.5 mt-1 pointer-events-none">
              <span className="text-xs text-gray-400 uppercase tracking-wide font-medium">System</span>
            </div>
            <DropdownMenuItem onClick={() => handleNavigation("/admin/tenants")} className="rounded-sm">
              <Building2 className="mr-2 h-4 w-4" />
              <span>Tenants</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation("/admin/global-users")} className="rounded-sm">
              <Users className="mr-2 h-4 w-4" />
              <span>Global Users</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Admin Section */}
        {isAdmin && (
          <>
            <div className="px-3 py-1.5 mt-1 pointer-events-none">
              <span className="text-xs text-gray-400 uppercase tracking-wide font-medium">Administration</span>
            </div>
            <DropdownMenuItem onClick={() => handleNavigation("/admin/users")} className="rounded-sm">
              <Users className="mr-2 h-4 w-4" />
              <span>Users & Access</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation("/admin/tenant")} className="rounded-sm">
              <Building2 className="mr-2 h-4 w-4" />
              <span>Tenant Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Sign Out */}
        <DropdownMenuItem 
          onClick={handleSignOut} 
          variant="destructive"
          className="rounded-sm"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sign Out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
