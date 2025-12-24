import { getAuthData } from "../services/authService";
import type { TenantUserRole } from "../types/admin";

/**
 * Check if user can manage users (invite, edit roles, disable/enable)
 * SYSTEM_ADMIN and TENANT_ADMIN can manage users
 */
export function canManageUsers(): boolean {
  const authData = getAuthData();
  const role = authData?.role;
  return role === 'ADMIN' || role === 'SYSTEM_ADMIN' || role === 'TENANT_ADMIN';
}

/**
 * Check if user can edit tenant settings
 * SYSTEM_ADMIN and TENANT_ADMIN can edit settings
 */
export function canEditTenantSettings(): boolean {
  const authData = getAuthData();
  const role = authData?.role;
  return role === 'ADMIN' || role === 'SYSTEM_ADMIN' || role === 'TENANT_ADMIN';
}

/**
 * Check if user can change another user's role
 * SYSTEM_ADMIN and TENANT_ADMIN can change roles
 */
export function canChangeUserRole(targetUserRole: TenantUserRole): boolean {
  const authData = getAuthData();
  const currentRole = authData?.role;
  
  return currentRole === 'ADMIN' || currentRole === 'SYSTEM_ADMIN' || currentRole === 'TENANT_ADMIN';
}

/**
 * Check if user can delete/disable a user
 * SYSTEM_ADMIN and TENANT_ADMIN can modify users
 */
export function canModifyUser(targetUserRole: TenantUserRole): boolean {
  const authData = getAuthData();
  const currentRole = authData?.role;
  
  return currentRole === 'ADMIN' || currentRole === 'SYSTEM_ADMIN' || currentRole === 'TENANT_ADMIN';
}

/**
 * Check if user is SYSTEM_ADMIN (for dangerous actions like delete tenant)
 * SYSTEM_ADMIN is the strongest role
 */
export function isAdmin(): boolean {
  const authData = getAuthData();
  const role = authData?.role;
  return role === 'ADMIN' || role === 'SYSTEM_ADMIN';
}

