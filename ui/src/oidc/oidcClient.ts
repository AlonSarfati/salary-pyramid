// NOTE: Vite env vars are read only at startup. Restart `npm run dev` after changing .env.local.
/// <reference types="vite/client" />
import { UserManager, WebStorageStateStore, Log, User } from "oidc-client-ts";

let userManager: UserManager | null = null;

function createUserManager() {
  const authority = import.meta.env.VITE_OIDC_AUTHORITY;
  const clientId = import.meta.env.VITE_OIDC_CLIENT_ID;

  // Safety check: ensure OIDC env vars are configured
  if (!authority || !clientId) {
    console.error(
      "❌ OIDC not configured. Ensure ui/.env.local exists and restart Vite.\n" +
      "   Required: VITE_OIDC_AUTHORITY and VITE_OIDC_CLIENT_ID"
    );
    // Do NOT throw - allow app to render AccessDenied screen with Sign In button
  } else {
    // Dev-only console log for verification
    console.info("✅ OIDC configured:");
    console.info("   OIDC authority:", authority);
    console.info("   OIDC client_id:", clientId);
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

export function getUserManager(): UserManager {
  if (!userManager) {
    userManager = createUserManager();
  }
  return userManager!;
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const mgr = getUserManager();
    let user = await mgr.getUser();
    
    // If user is expired, try to renew it silently
    if (user && user.expired) {
      if (import.meta.env.DEV) {
        console.info("OIDC: Token expired, attempting silent renewal...");
      }
      try {
        user = await mgr.signinSilent();
        if (import.meta.env.DEV) {
          console.info("OIDC: Silent renewal successful");
        }
      } catch (silentError) {
        if (import.meta.env.DEV) {
          console.warn("OIDC: Silent renewal failed:", silentError);
        }
        // If silent renewal fails, return null (user will need to sign in again)
        return null;
      }
    }
    
    if (!user) {
      return null;
    }
    
    return user;
  } catch (e) {
    console.warn("OIDC getUser failed:", e);
    return null;
  }
}


