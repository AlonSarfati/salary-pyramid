import { AlertCircle, LogIn, Mail, Shield } from "lucide-react";
import { getUserManager, isOidcConfigured } from "../oidc/oidcClient";
import { tenantApi } from "../services/apiService";

type AccessDeniedProps = {
  error?: string;
  message?: string;
};

export default function AccessDenied({ error, message }: AccessDeniedProps) {
  const isDisabled = error === "ACCOUNT_DISABLED";
  const isNotAuthenticated = error === "NOT_AUTHENTICATED";
  const isNotApproved = error === "ACCESS_DENIED" || (!error && !isNotAuthenticated);
  const oidcConfigured = isOidcConfigured();

  const handleSignIn = async () => {
    // First, check if backend is in permit-all mode by trying to call an API without auth
    try {
      await tenantApi.list();
      // If this succeeds, backend is in permit-all mode - just reload
      console.info("Backend is in permit-all mode. Reloading page.");
      window.location.reload();
      return;
    } catch (e: any) {
      // If API call fails with 401/403, backend requires auth - try OIDC
      if (e.status === 401 || e.status === 403) {
        if (!oidcConfigured) {
          // OIDC not configured but backend requires auth - show error
          console.error("Backend requires authentication but OIDC is not configured.");
          window.location.reload();
          return;
        }
        
        // Try OIDC sign-in
        try {
          const mgr = getUserManager();
          if (mgr) {
            await mgr.signinRedirect();
          } else {
            // OIDC configured but manager not available - reload
            window.location.reload();
          }
        } catch (oidcError: any) {
          console.error("OIDC signinRedirect failed:", oidcError);
          // If OIDC connection fails (Keycloak not running), reload to check backend mode again
          if (oidcError.message?.includes("Failed to fetch") || oidcError.message?.includes("Network Error")) {
            console.info("OIDC connection failed (Keycloak may not be running). Reloading to check backend mode.");
            window.location.reload();
          }
        }
      } else {
        // Other error - just reload
        window.location.reload();
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#EEF2F8] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mb-6 flex justify-center">
          {isDisabled ? (
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
              <Shield className="w-8 h-8 text-red-600" />
            </div>
          ) : isNotAuthenticated ? (
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
              <LogIn className="w-8 h-8 text-blue-600" />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-yellow-600" />
            </div>
          )}
        </div>

        <h1 className="text-2xl font-semibold text-[#1E1E1E] mb-4">
          {isDisabled
            ? "Account Disabled"
            : isNotAuthenticated
            ? "Sign In Required"
            : "Access Not Approved"}
        </h1>

        <p className="text-gray-600 mb-6">
          {isDisabled
            ? message ||
              "Your account has been disabled. Please contact your administrator for assistance."
            : isNotAuthenticated
            ? message ||
              "You are not logged in. Please sign in with your organization account to access the simulator."
            : message ||
              "Your account is not approved yet. Please contact your administrator to request access."}
        </p>

        <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
          <div className="flex items-start gap-3">
            <Mail className="w-5 h-5 text-gray-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Need Help?</p>
              <p className="text-sm text-gray-600">
                Contact your system administrator to request access or resolve account issues.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="text-xs text-gray-500 mt-4">
            Error Code: <code className="bg-gray-100 px-2 py-1 rounded">{error}</code>
          </div>
        )}

        {isNotAuthenticated && oidcConfigured ? (
          <button
            onClick={handleSignIn}
            className="mt-6 px-6 py-2 bg-[#0052CC] text-white rounded-lg hover:bg-[#0042A3] transition-colors flex items-center justify-center gap-2 mx-auto"
          >
            <LogIn className="w-4 h-4" />
            <span>Sign In</span>
          </button>
        ) : (
          <button
            onClick={handleSignIn}
            className="mt-6 px-6 py-2 bg-[#0052CC] text-white rounded-lg hover:bg-[#0042A3] transition-colors"
          >
            {oidcConfigured ? "Retry" : "Reload"}
          </button>
        )}
      </div>
    </div>
  );
}

