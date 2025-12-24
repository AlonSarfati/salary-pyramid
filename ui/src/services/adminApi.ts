// Admin API service
import { getAuthToken } from "./authService";
import type {
  TenantUser,
  TenantInvite,
  TenantSettings,
  InviteUserRequest,
  UpdateUserRoleRequest,
  UpdateUserStatusRequest,
} from "../types/admin";

const API_BASE = "/api";

async function apiCall<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(options?.headers as Record<string, string> || {}),
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });
  
  if (!response.ok) {
    let errorMessage = `API error: ${response.status}`;
    let errorCode: string | null = null;
    try {
      const errorData = await response.json();
      if (errorData.message) {
        errorMessage = errorData.message;
      } else if (errorData.error) {
        errorCode = errorData.error;
        errorMessage = errorData.message || errorData.error;
      }
    } catch {
      const errorText = await response.text();
      if (errorText) {
        errorMessage = errorText;
      }
    }
    const err: any = new Error(errorMessage);
    err.status = response.status;
    err.error = errorCode;
    throw err;
  }
  
  // Handle empty responses (204 No Content)
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return {} as T;
  }
  
  // Handle JSON responses
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }
  
  return {} as T;
}

export const adminApi = {
  // Users
  async getUsers(tenantId: string): Promise<TenantUser[]> {
    const response = await apiCall<any>(`/admin/${tenantId}/users`);
    // Backend now returns {users: [...], actingAs: {...}}
    // Extract users array from response
    if (response && response.users && Array.isArray(response.users)) {
      return response.users;
    }
    // Fallback: if response is already an array (backwards compatibility)
    if (Array.isArray(response)) {
      return response;
    }
    return [];
  },

  async inviteUser(tenantId: string, request: InviteUserRequest): Promise<TenantInvite> {
    const response = await apiCall<any>(`/admin/${tenantId}/invites`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
    // Map backend response to frontend type
    return {
      id: response.id,
      email: response.email,
      role: response.role,
      invitedAt: response.invitedAt,
      invitedBy: response.invitedBy || "",
    };
  },

  async getInvites(tenantId: string): Promise<TenantInvite[]> {
    const response = await apiCall<any>(`/admin/${tenantId}/invites`);
    // Backend now returns {invites: [...], actingAs: {...}}
    // Extract invites array from response
    let inviteArray: any[] = [];
    if (response && response.invites && Array.isArray(response.invites)) {
      inviteArray = response.invites;
    } else if (Array.isArray(response)) {
      // Fallback: if response is already an array (backwards compatibility)
      inviteArray = response;
    }
    // Map backend response to frontend type
    return inviteArray.map((i: any) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      status: i.status || 'PENDING',
      invitedAt: i.invitedAt,
      invitedBy: i.invitedBy || "",
      expiresAt: i.expiresAt,
      expiresInDays: i.expiresInDays,
      acceptedAt: i.acceptedAt,
      acceptedBy: i.acceptedBy,
    }));
  },

  async updateUserRole(tenantId: string, userId: string, request: UpdateUserRoleRequest): Promise<void> {
    return apiCall<void>(`/admin/${tenantId}/users/${userId}/role`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  async updateUserStatus(tenantId: string, userId: string, request: UpdateUserStatusRequest): Promise<void> {
    return apiCall<void>(`/admin/${tenantId}/users/${userId}/status`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  async deleteUser(tenantId: string, userId: string): Promise<void> {
    return apiCall<void>(`/admin/${tenantId}/users/${userId}`, {
      method: 'DELETE',
    });
  },

  async deleteInvite(tenantId: string, inviteId: string): Promise<void> {
    return apiCall<void>(`/admin/${tenantId}/invites/${inviteId}`, {
      method: 'DELETE',
    });
  },

  // Settings
  async getSettings(tenantId: string): Promise<TenantSettings> {
    return apiCall<TenantSettings>(`/admin/${tenantId}/settings`);
  },

  async updateSettings(tenantId: string, settings: Partial<TenantSettings>): Promise<TenantSettings> {
    return apiCall<TenantSettings>(`/admin/${tenantId}/settings`, {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  },
};

