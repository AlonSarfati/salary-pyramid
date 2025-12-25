// Auth service for managing authentication state and JWT tokens
// Tokens are kept in memory; OIDC client handles its own storage.

const AUTH_DATA_KEY = 'lira_auth_data';
let currentToken: string | null = null;

export type AuthData = {
  userIdentity: {
    issuer: string;
    subject: string;
    email: string | null;
    displayName: string | null;
  };
  role: string;
  mode: string;
  allowedTenantIds: string[];
  primaryTenantId?: string;
  tenantRoles?: Record<string, string>; // Map of tenantId -> role
};

// Store JWT token (call this after OIDC login)
export function setAuthToken(token: string | null) {
  currentToken = token;
}

// Get stored JWT token
export function getAuthToken(): string | null {
  return currentToken;
}

// Clear auth token (logout)
export function clearAuthToken() {
  currentToken = null;
  localStorage.removeItem(AUTH_DATA_KEY);
}

// Store auth data from /api/auth/me
export function setAuthData(data: AuthData) {
  localStorage.setItem(AUTH_DATA_KEY, JSON.stringify(data));
}

// Get stored auth data
export function getAuthData(): AuthData | null {
  const data = localStorage.getItem(AUTH_DATA_KEY);
  return data ? JSON.parse(data) : null;
}

// Check if user is authenticated
export function isAuthenticated(): boolean {
  return getAuthToken() !== null;
}

// Get authorization header for API calls
export function getAuthHeader(): Record<string, string> {
  const token = getAuthToken();
  if (token) {
    return { 'Authorization': `Bearer ${token}` };
  }
  return {};
}

