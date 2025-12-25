import { FileText } from "lucide-react";
import { Card } from "./ui/card";

export default function AdminAuditPage() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-[#1E1E1E] mb-1">Audit Log</h2>
        <p className="text-sm text-gray-600">
          View system-wide audit trail of administrative actions.
        </p>
      </div>

      <Card className="rounded-sm p-12 text-center">
        <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500 mb-2">Audit Log</p>
        <p className="text-sm text-gray-400">
          System-wide audit log coming soon.
        </p>
      </Card>
    </div>
  );
}

