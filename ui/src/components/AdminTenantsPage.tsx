import { Card } from "./ui/card";
import { Building2 } from "lucide-react";

export default function AdminTenantsPage() {
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#1E1E1E] mb-2 flex items-center gap-2">
          <Building2 className="w-6 h-6 text-[#0052CC]" />
          Tenants
        </h1>
        <p className="text-gray-600">Manage all tenants in the system</p>
      </div>

      <Card className="p-6">
        <div className="text-center py-12">
          <p className="text-gray-500">Tenant management interface coming soon</p>
          <p className="text-sm text-gray-400 mt-2">
            This page will allow system administrators to manage all tenants.
          </p>
        </div>
      </Card>
    </div>
  );
}

