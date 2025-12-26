// NOTE: Vite env vars are read only at startup. Restart `npm run dev` after changing .env.local.
/// <reference types="vite/client" />
import { UserManager, WebStorageStateStore, Log, User } from "oidc-client-ts";

let userManager: UserManager | null = null;

/**
 * Check if OIDC is configured
 */
export function isOidcConfigured(): boolean {
  const authority = import.meta.env.VITE_OIDC_AUTHORITY;
  const clientId = import.meta.env.VITE_OIDC_CLIENT_ID;
  return !!(authority && clientId);
}

function createUserManager() {
  const authority = import.meta.env.VITE_OIDC_AUTHORITY;
  const clientId = import.meta.env.VITE_OIDC_CLIENT_ID;

  // Safety check: ensure OIDC env vars are configured
  if (!authority || !clientId) {
    console.info(
      "ℹ️ OIDC not configured. Running in no-auth mode (backend permit-all mode).\n" +
      "   To enable OIDC, set VITE_OIDC_AUTHORITY and VITE_OIDC_CLIENT_ID in ui/.env.local"
    );
    // Return null to indicate OIDC is not available
    return null as any;
  }

  const redirectUri = `${window.location.origin}/auth/callback`;
  const postLogoutRedirectUri = `${window.location.origin}/`;

  // Optional: enable logging during development
  if (import.meta.env.DEV) {
    Log.setLogger(console);
    Log.setLevel(Log.DEBUG);
  }

  return new UserManager({
    authority: authority || "", // Will fail gracefully if missing
    client_id: clientId || "", // Will fail gracefully if missing
    redirect_uri: redirectUri,
    post_logout_redirect_uri: postLogoutRedirectUri,
    response_type: "code",
    scope: "openid profile email",
    // Use sessionStorage for OIDC internal state/user store
    userStore: new WebStorageStateStore({ store: window.sessionStorage }),
    // Enable automatic silent token renewal to prevent interruptions
    automaticSilentRenew: true,
    // Renew token when it's within 60 seconds of expiring (default is 60s)
    accessTokenExpiringNotificationTimeInSeconds: 60,
    // Use silent redirect for token renewal (no user interaction needed)
    silent_redirect_uri: `${window.location.origin}/auth/callback`,
  });
}

export function getUserManager(): UserManager | null {
  if (!isOidcConfigured()) {
    return null;
  }
  if (!userManager) {
    userManager = createUserManager();
  }
  return userManager;
}

export async function getCurrentUser(): Promise<User | null> {
  if (!isOidcConfigured()) {
    return null;
  }
  try {
    const mgr = getUserManager();
    if (!mgr) {
      return null;
    }
    let user = await mgr.getUser();
    
    // If user is expired, try to renew it silently
    if (user && user.expired) {
      try {
        user = await mgr.signinSilent();
      } catch (silentError) {
        // If silent renewal fails, return null (user will need to sign in again)
        return null;
      }
    }
    
    if (!user) {
      return null;
    }
    
    return user;
  } catch (e) {
    return null;
  }
}


