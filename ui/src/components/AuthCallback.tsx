import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getUserManager } from "../oidc/oidcClient";
import { setAuthToken } from "../services/authService";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const mgr = getUserManager();
        const user = await mgr.signinRedirectCallback();
        if (user && user.access_token) {
          setAuthToken(user.access_token);
        }
      } catch (e) {
        console.error("OIDC signinRedirectCallback failed:", e);
      } finally {
        navigate("/", { replace: true });
      }
    })();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#EEF2F8] flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-[#0052CC] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Completing sign-in...</p>
      </div>
    </div>
  );
}


