import { getAuthData } from "../services/authService";
import type { Capability, SystemRole, TenantUserRole } from "../types/admin";

/**
 * Normalize system role name (backwards compatibility)
 */
function normalizeSystemRole(role: string | undefined): string | null {
  if (!role) return null;
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
}

/**
 * Normalize tenant role name (backwards compatibility)
 */
function normalizeTenantRole(role: string | undefined): string | null {
  if (!role) return null;
  switch (role) {
    case "ADMIN":
      return "TENANT_ADMIN";
    case "EDITOR":
      return "TENANT_EDITOR";
    case "VIEWER":
      return "TENANT_VIEWER";
    default:
      return role;
  }
}

/**
 * Get capabilities for a system-level role
 */
function getCapabilitiesForSystemRole(role: string | undefined): Set<Capability> {
  const normalized = normalizeSystemRole(role);
  if (normalized === "SYSTEM_ADMIN" || role === "ADMIN") {
    return new Set([
      "system.tenants.manage",
      "tenant.users.manage",
      "tenant.settings.edit",
      "tenant.exports.manage",
      "tenant.danger.delete",
    ]);
  }
  return new Set();
}

/**
 * Get capabilities for a tenant-level role
 */
function getCapabilitiesForTenantRole(role: string | undefined): Set<Capability> {
  const normalized = normalizeTenantRole(role);
  if (normalized === "TENANT_ADMIN" || role === "ADMIN") {
    return new Set([
      "tenant.users.manage",
      "tenant.settings.edit",
      "tenant.exports.manage",
    ]);
  }
  return new Set();
}

/**
 * Check if user has a specific capability for a tenant.
 * 
 * @param capability The capability to check
 * @param tenantId The tenant ID (for tenant-scoped capabilities)
 * @returns true if user has the capability
 */
export function can(capability: Capability, tenantId?: string): boolean {
  const authData = getAuthData();
  if (!authData) {
    return false;
  }

  const systemRole = authData.role;
  const tenantRole = authData.tenantRole; // Would need to be added to authData
  const canAccessAllTenants = normalizeSystemRole(systemRole) === "SYSTEM_ADMIN" || systemRole === "ADMIN";

  // Get capabilities from both roles
  const systemCapabilities = getCapabilitiesForSystemRole(systemRole);
  const tenantCapabilities = getCapabilitiesForTenantRole(tenantRole);

  // Combine capabilities
  const allCapabilities = new Set([...systemCapabilities, ...tenantCapabilities]);

  // Check if capability exists
  if (!allCapabilities.has(capability)) {
    return false;
  }

  // For system-level capabilities, check if user can access all tenants
  if (capability === "system.tenants.manage" || capability === "tenant.danger.delete") {
    return canAccessAllTenants;
  }

  // For tenant-scoped capabilities, check tenant access
  if (capability.startsWith("tenant.")) {
    if (canAccessAllTenants) {
      return true; // SYSTEM_ADMIN can access any tenant
    }
    if (tenantId) {
      return authData.allowedTenantIds?.includes(tenantId) ?? false;
    }
    return true; // If no tenantId specified, allow if has any tenant access
  }

  return true;
}

/**
 * Get a human-readable label for a capability requirement
 */
export function getCapabilityRequirement(capability: Capability): string {
  switch (capability) {
    case "system.tenants.manage":
      return "Requires SYSTEM_ADMIN";
    case "tenant.danger.delete":
      return "Requires SYSTEM_ADMIN";
    case "tenant.users.manage":
      return "Requires TENANT_ADMIN or SYSTEM_ADMIN";
    case "tenant.settings.edit":
      return "Requires TENANT_ADMIN or SYSTEM_ADMIN";
    case "tenant.exports.manage":
      return "Requires TENANT_ADMIN or SYSTEM_ADMIN";
    default:
      return "Requires admin access";
  }
}

