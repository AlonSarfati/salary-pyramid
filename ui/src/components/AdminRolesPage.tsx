import { Shield } from "lucide-react";
import { Card } from "./ui/card";

export default function AdminRolesPage() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-[#1E1E1E] mb-1">Roles & Permissions</h2>
        <p className="text-sm text-gray-600">
          View system and tenant role definitions and their capabilities.
        </p>
      </div>

      <Card className="rounded-sm p-12 text-center">
        <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500 mb-2">Roles & Permissions</p>
        <p className="text-sm text-gray-400">
          Role definitions and capability matrix coming soon.
        </p>
      </Card>
    </div>
  );
}

