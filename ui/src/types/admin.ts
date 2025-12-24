// Admin types for Users & Access and Tenant Settings

export type TenantUserRole = 'ADMIN' | 'EDITOR' | 'VIEWER';
export type TenantUserStatus = 'ACTIVE' | 'INVITED' | 'DISABLED';
export type RoundingMode = 'NONE' | 'NEAREST_0_5' | 'NEAREST_1';

export interface TenantUser {
  id: string;
  name: string;
  email: string;
  role: TenantUserRole;
  status: TenantUserStatus;
  lastLoginAt?: string;
  createdAt: string;
}

export interface TenantInvite {
  id: string;
  email: string;
  role: TenantUserRole;
  invitedAt: string;
  invitedBy: string;
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

