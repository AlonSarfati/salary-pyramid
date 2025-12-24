import { getAuthData } from "../services/authService";
import type { TenantUserRole } from "../types/admin";

/**
 * Check if user can manage users (invite, edit roles, disable/enable)
 * ADMIN is the strongest role and can manage everything
 */
export function canManageUsers(): boolean {
  const authData = getAuthData();
  const role = authData?.role;
  return role === 'ADMIN';
}

/**
 * Check if user can edit tenant settings
 * ADMIN is the strongest role and can edit everything
 */
export function canEditTenantSettings(): boolean {
  const authData = getAuthData();
  const role = authData?.role;
  return role === 'ADMIN';
}

/**
 * Check if user can change another user's role
 * ADMIN can change anyone's role
 */
export function canChangeUserRole(targetUserRole: TenantUserRole): boolean {
  const authData = getAuthData();
  const currentRole = authData?.role;
  
  // ADMIN can change anyone's role
  return currentRole === 'ADMIN';
}

/**
 * Check if user can delete/disable a user
 * ADMIN can modify any user
 */
export function canModifyUser(targetUserRole: TenantUserRole): boolean {
  const authData = getAuthData();
  const currentRole = authData?.role;
  
  // ADMIN can modify any user
  return currentRole === 'ADMIN';
}

/**
 * Check if user is ADMIN (for dangerous actions like delete tenant)
 * ADMIN is the strongest role
 */
export function isAdmin(): boolean {
  const authData = getAuthData();
  return authData?.role === 'ADMIN';
}

