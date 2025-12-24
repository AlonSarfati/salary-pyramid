// Admin types for Users & Access and Tenant Settings

// System-level roles (from access_allowlist)
export type SystemRole = 'SYSTEM_ADMIN' | 'SYSTEM_ANALYST' | 'SYSTEM_VIEWER' | 'ADMIN' | 'ANALYST' | 'VIEWER'; // Include old names for backwards compat

// Tenant-level roles (from tenant_users)
export type TenantUserRole = 'TENANT_ADMIN' | 'TENANT_EDITOR' | 'TENANT_VIEWER' | 'ADMIN' | 'EDITOR' | 'VIEWER'; // Include old names for backwards compat
export type TenantUserStatus = 'ACTIVE' | 'INVITED' | 'DISABLED';
export type InviteStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
export type RoundingMode = 'NONE' | 'NEAREST_0_5' | 'NEAREST_1';
export type RoleSource = 'SYSTEM_ALLOWLIST' | 'TENANT_MEMBERSHIP';

// Capabilities
export type Capability = 
  | 'system.tenants.manage'
  | 'tenant.users.manage'
  | 'tenant.settings.edit'
  | 'tenant.exports.manage'
  | 'tenant.danger.delete';

export interface TenantUser {
  id: string;
  name: string;
  email: string;
  role: TenantUserRole;
  effectiveRole: TenantUserRole;
  roleSource: RoleSource;
  status: TenantUserStatus;
  lastLoginAt?: string;
  createdAt: string;
}

export interface TenantInvite {
  id: string;
  email: string;
  role: TenantUserRole;
  status: InviteStatus;
  invitedAt: string;
  invitedBy: string;
  expiresAt?: string;
  expiresInDays?: number;
  acceptedAt?: string;
  acceptedBy?: string;
}

export interface ActingAs {
  effectiveRole: string;
  roleSource: RoleSource;
  canAccessAllTenants: boolean;
}

export interface AuditLogEntry {
  id: string;
  createdAt: string;
  actorUserIdentityId: string;
  actorSource: RoleSource;
  actionType: string;
  targetType: 'USER' | 'INVITE' | 'SETTINGS';
  targetId?: string;
  diffJson: Record<string, any>;
  notes?: string;
}

export interface TenantSettings {
  tenantId: string;
  name: string;
  timezone: string;
  currency: string;
  locale: string;
  rounding: RoundingMode;
  retentionDays: number;
  exports: {
    csv: boolean;
    xlsx: boolean;
    pdf: boolean;
  };
  sessionTimeoutMinutes: number;
  allowedEmailDomains: string[];
  requireSso: boolean;
}

export interface InviteUserRequest {
  email: string;
  role: TenantUserRole;
}

export interface UpdateUserRoleRequest {
  role: TenantUserRole;
}

export interface UpdateUserStatusRequest {
  status: 'ACTIVE' | 'DISABLED';
}

