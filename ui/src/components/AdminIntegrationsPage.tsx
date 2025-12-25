import { Plug } from "lucide-react";
import { Card } from "./ui/card";

export default function AdminIntegrationsPage() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-[#1E1E1E] mb-1">Integrations</h2>
        <p className="text-sm text-gray-600">
          Manage system integrations and external service connections.
        </p>
      </div>

      <Card className="rounded-sm p-12 text-center">
        <Plug className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500 mb-2">Integrations</p>
        <p className="text-sm text-gray-400">
          Integration management coming soon.
        </p>
      </Card>
    </div>
  );
}

