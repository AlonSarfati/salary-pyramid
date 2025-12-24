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
    automaticSilentRenew: false,
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
    const user = await mgr.getUser();
    if (!user || user.expired) {
      return null;
    }
    return user;
  } catch (e) {
    console.warn("OIDC getUser failed:", e);
    return null;
  }
}


