import { useState } from 'react';
import { Plus, Edit, Trash2, Key, Users, Building2, History } from 'lucide-react';
import { Card } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('tenants');

  const tenants = [
    { id: 1, name: 'Acme Corp', status: 'Active', users: 1247, created: '2023-01-15' },
    { id: 2, name: 'TechStart Inc', status: 'Active', users: 89, created: '2023-06-20' },
    { id: 3, name: 'Global Enterprises', status: 'Active', users: 3542, created: '2022-11-10' },
    { id: 4, name: 'Innovation Labs', status: 'Inactive', users: 12, created: '2024-09-05' },
  ];

  const roles = [
    { id: 1, name: 'Admin', users: 5, permissions: 'Full Access' },
    { id: 2, name: 'HR Manager', users: 23, permissions: 'View & Edit Rules, Run Simulations' },
    { id: 3, name: 'Finance Viewer', users: 15, permissions: 'View Results Only' },
    { id: 4, name: 'Payroll Specialist', users: 8, permissions: 'View & Run Simulations' },
  ];

  const integrations = [
    { id: 1, name: 'Workday', status: 'Connected', lastSync: '2024-11-10 08:30' },
    { id: 2, name: 'SAP SuccessFactors', status: 'Connected', lastSync: '2024-11-10 07:15' },
    { id: 3, name: 'BambooHR', status: 'Disconnected', lastSync: 'Never' },
    { id: 4, name: 'ADP', status: 'Connected', lastSync: '2024-11-09 23:45' },
  ];

  const auditLogs = [
    { id: 1, user: 'John Doe', action: 'Published ruleset "2024 Annual Rules"', timestamp: '2024-11-10 09:15' },
    { id: 2, user: 'Jane Smith', action: 'Created new simulation "Q4 2024 Engineering"', timestamp: '2024-11-10 08:45' },
    { id: 3, user: 'Mike Johnson', action: 'Updated component "Performance Bonus"', timestamp: '2024-11-09 16:30' },
    { id: 4, user: 'Sarah Williams', action: 'Deleted simulation "Test Run 123"', timestamp: '2024-11-09 14:20' },
    { id: 5, user: 'David Brown', action: 'Added new user "Emily Davis"', timestamp: '2024-11-09 11:00' },
  ];

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <h1 className="text-[#1E1E1E] mb-8">Admin</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="tenants" className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Tenants
          </TabsTrigger>
          <TabsTrigger value="roles" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Roles
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex items-center gap-2">
            <Key className="w-4 h-4" />
            Integrations
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            Audit
          </TabsTrigger>
        </TabsList>

        {/* Tenants Tab */}
        <TabsContent value="tenants">
          <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-[#1E1E1E]">Tenants</h3>
              <button className="flex items-center gap-2 px-6 py-3 bg-[#0052CC] text-white rounded-xl hover:bg-[#0047b3] transition-colors">
                <Plus className="w-5 h-5" />
                Add Tenant
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm text-gray-600">Name</th>
                    <th className="text-left py-3 px-4 text-sm text-gray-600">Status</th>
                    <th className="text-right py-3 px-4 text-sm text-gray-600">Users</th>
                    <th className="text-left py-3 px-4 text-sm text-gray-600">Created</th>
                    <th className="text-right py-3 px-4 text-sm text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((tenant) => (
                    <tr key={tenant.id} className="border-b border-gray-100 hover:bg-[#EEF2F8] transition-colors">
                      <td className="py-3 px-4 text-sm text-[#1E1E1E]">{tenant.name}</td>
                      <td className="py-3 px-4">
                        <Badge className={tenant.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'}>
                          {tenant.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600 text-right">{tenant.users.toLocaleString()}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">{tenant.created}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button className="p-2 hover:bg-gray-200 rounded transition-colors">
                            <Edit className="w-4 h-4 text-gray-600" />
                          </button>
                          <button className="p-2 hover:bg-red-100 rounded transition-colors">
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* Roles Tab */}
        <TabsContent value="roles">
          <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-[#1E1E1E]">Roles & Permissions</h3>
              <button className="flex items-center gap-2 px-6 py-3 bg-[#0052CC] text-white rounded-xl hover:bg-[#0047b3] transition-colors">
                <Plus className="w-5 h-5" />
                Add Role
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm text-gray-600">Role Name</th>
                    <th className="text-right py-3 px-4 text-sm text-gray-600">Users</th>
                    <th className="text-left py-3 px-4 text-sm text-gray-600">Permissions</th>
                    <th className="text-right py-3 px-4 text-sm text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map((role) => (
                    <tr key={role.id} className="border-b border-gray-100 hover:bg-[#EEF2F8] transition-colors">
                      <td className="py-3 px-4 text-sm text-[#1E1E1E]">{role.name}</td>
                      <td className="py-3 px-4 text-sm text-gray-600 text-right">{role.users}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">{role.permissions}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button className="p-2 hover:bg-gray-200 rounded transition-colors">
                            <Edit className="w-4 h-4 text-gray-600" />
                          </button>
                          <button className="p-2 hover:bg-red-100 rounded transition-colors">
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations">
          <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-[#1E1E1E]">Integrations</h3>
              <button className="flex items-center gap-2 px-6 py-3 bg-[#0052CC] text-white rounded-xl hover:bg-[#0047b3] transition-colors">
                <Plus className="w-5 h-5" />
                Add Integration
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm text-gray-600">Name</th>
                    <th className="text-left py-3 px-4 text-sm text-gray-600">Status</th>
                    <th className="text-left py-3 px-4 text-sm text-gray-600">Last Sync</th>
                    <th className="text-right py-3 px-4 text-sm text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {integrations.map((integration) => (
                    <tr key={integration.id} className="border-b border-gray-100 hover:bg-[#EEF2F8] transition-colors">
                      <td className="py-3 px-4 text-sm text-[#1E1E1E]">{integration.name}</td>
                      <td className="py-3 px-4">
                        <Badge className={integration.status === 'Connected' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                          {integration.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">{integration.lastSync}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button className="p-2 hover:bg-gray-200 rounded transition-colors">
                            <Edit className="w-4 h-4 text-gray-600" />
                          </button>
                          <button className="p-2 hover:bg-red-100 rounded transition-colors">
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* Audit Tab */}
        <TabsContent value="audit">
          <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
            <h3 className="text-[#1E1E1E] mb-6">Audit Log</h3>
            <div className="space-y-3">
              {auditLogs.map((log) => (
                <div key={log.id} className="p-4 bg-[#EEF2F8] rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="text-sm text-[#1E1E1E] mb-1">{log.action}</div>
                      <div className="text-xs text-gray-600">by {log.user}</div>
                    </div>
                    <div className="text-xs text-gray-500">{log.timestamp}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
