import { useEffect, useState } from "react";
import { Card } from "./ui/card";
import { Label } from "./ui/label";
import { getAuthData } from "../services/authService";
import { authApi } from "../services/apiService";
import { StateScreen } from "./ui/StateScreen";
import { User, Mail, Shield, Building2, Loader2 } from "lucide-react";

export default function UserInfo() {
  const [authData, setAuthData] = useState(getAuthData());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Refresh auth data from backend
    const refreshAuthData = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await authApi.getMe();
        setAuthData(data);
      } catch (err: any) {
        setError(err.message || "Failed to load user information");
      } finally {
        setLoading(false);
      }
    };

    refreshAuthData();
  }, []);

  if (loading) {
    return (
      <StateScreen
        icon={Loader2}
        title="Loading..."
        description="Fetching user information"
        iconClassName="animate-spin"
      />
    );
  }

  if (error) {
    return (
      <StateScreen
        icon={Mail}
        title="Error"
        description={error}
      />
    );
  }

  if (!authData) {
    return (
      <StateScreen
        icon={User}
        title="No User Data"
        description="User information is not available"
      />
    );
  }

  const { userIdentity, role, mode, allowedTenantIds, primaryTenantId } = authData;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#1E1E1E] mb-2">User Information</h1>
        <p className="text-gray-600">View your account details and access information</p>
      </div>

      <div className="space-y-4">
        {/* Personal Information */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-[#1E1E1E] mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-[#0052CC]" />
            Personal Information
          </h2>
          <div className="space-y-4">
            <div>
              <Label className="text-sm text-gray-600">Display Name</Label>
              <p className="text-[#1E1E1E] font-medium mt-1">
                {userIdentity.displayName || "Not provided"}
              </p>
            </div>
            <div>
              <Label className="text-sm text-gray-600">Email</Label>
              <p className="text-[#1E1E1E] font-medium mt-1 flex items-center gap-2">
                <Mail className="w-4 h-4 text-gray-400" />
                {userIdentity.email || "Not provided"}
              </p>
            </div>
          </div>
        </Card>

        {/* Account Information */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-[#1E1E1E] mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#0052CC]" />
            Account Information
          </h2>
          <div className="space-y-4">
            <div>
              <Label className="text-sm text-gray-600">Role</Label>
              <p className="text-[#1E1E1E] font-medium mt-1 capitalize">
                {role.toLowerCase()}
              </p>
            </div>
            <div>
              <Label className="text-sm text-gray-600">Access Mode</Label>
              <p className="text-[#1E1E1E] font-medium mt-1">
                {mode === "SINGLE_TENANT" ? "Single Tenant" : "Multi Tenant"}
              </p>
            </div>
            {primaryTenantId && (
              <div>
                <Label className="text-sm text-gray-600">Primary Tenant</Label>
                <p className="text-[#1E1E1E] font-medium mt-1">{primaryTenantId}</p>
              </div>
            )}
          </div>
        </Card>

        {/* Tenant Access */}
        {allowedTenantIds && allowedTenantIds.length > 0 && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-[#1E1E1E] mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#0052CC]" />
              Tenant Access
            </h2>
            <div>
              <Label className="text-sm text-gray-600">Allowed Tenants</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {allowedTenantIds.map((tenantId) => (
                  <span
                    key={tenantId}
                    className="px-3 py-1 bg-[#EEF2F8] text-[#0052CC] rounded-md text-sm font-medium"
                  >
                    {tenantId}
                  </span>
                ))}
              </div>
            </div>
          </Card>
        )}

        {/* Technical Details */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-[#1E1E1E] mb-4">Technical Details</h2>
          <div className="space-y-4">
            <div>
              <Label className="text-sm text-gray-600">Issuer</Label>
              <p className="text-[#1E1E1E] font-mono text-sm mt-1 break-all">
                {userIdentity.issuer}
              </p>
            </div>
            <div>
              <Label className="text-sm text-gray-600">Subject</Label>
              <p className="text-[#1E1E1E] font-mono text-sm mt-1 break-all">
                {userIdentity.subject}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

