import { useState, useEffect } from "react";
import { Users, Plus, Edit, Trash2, CheckCircle, XCircle, Building2, Mail } from "lucide-react";
import { useToast } from "./ToastProvider";
import { apiCall } from "../services/apiService";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./ui/breadcrumb";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Badge } from "./ui/badge";
import { Skeleton } from "./ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Textarea } from "./ui/textarea";

type AllowlistEntry = {
  id: string;
  email: string;
  issuer?: string;
  subject?: string;
  status: 'ACTIVE' | 'DISABLED';
  mode: 'SINGLE_TENANT' | 'MULTI_TENANT';
  role: 'SYSTEM_ADMIN' | 'SYSTEM_ANALYST' | 'SYSTEM_VIEWER' | 'ADMIN' | 'ANALYST' | 'VIEWER';
  tenantIds: string[];
  createdAt: string;
  notes?: string;
};

export default function AdminGlobalUsersPage() {
  const { showToast } = useToast();
  const [entries, setEntries] = useState<AllowlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ type: 'network' | 'system'; message?: string } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; entry: AllowlistEntry | null }>({
    open: false,
    entry: null,
  });
  const [editingEntry, setEditingEntry] = useState<AllowlistEntry | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    mode: 'MULTI_TENANT' as 'SINGLE_TENANT' | 'MULTI_TENANT',
    role: 'SYSTEM_ADMIN' as 'SYSTEM_ADMIN' | 'SYSTEM_ANALYST' | 'SYSTEM_VIEWER',
    tenantIds: [] as string[],
    notes: '',
  });
  const [availableTenants, setAvailableTenants] = useState<string[]>([]);
  const [newTenantId, setNewTenantId] = useState('');

  useEffect(() => {
    loadEntries();
    loadTenants();
  }, []);

  const loadTenants = async () => {
    try {
      const tenants = await apiCall('/tenants');
      const tenantIds = tenants.map((t: any) => t.tenantId || t.tenant_id);
      setAvailableTenants(tenantIds);
    } catch (e) {
      console.error("Failed to load tenants:", e);
    }
  };

  const loadEntries = async () => {
    try {
      setLoading(true);
      setError(null);
      // Note: This endpoint currently requires admin key, but should be updated to use OIDC auth
      // For now, we'll try to call it and handle errors gracefully
      const data = await apiCall('/admin/allowlist');
      setEntries(data);
    } catch (e: any) {
      const isNetworkError = e.message?.includes('fetch') || e.message?.includes('network') || e.message?.includes('Failed to fetch');
      setError({
        type: isNetworkError ? 'network' : 'system',
        message: e.message || 'Failed to load allowlist entries. This endpoint requires system admin access.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingEntry(null);
    setFormData({
      email: '',
      mode: 'MULTI_TENANT',
      role: 'SYSTEM_ADMIN',
      tenantIds: [],
      notes: '',
    });
    setNewTenantId('');
    setDialogOpen(true);
  };

  const handleEdit = (entry: AllowlistEntry) => {
    setEditingEntry(entry);
    setFormData({
      email: entry.email,
      mode: entry.mode,
      role: entry.role,
      tenantIds: [...entry.tenantIds],
      notes: entry.notes || '',
    });
    setNewTenantId('');
    setDialogOpen(true);
  };

  const handleAddTenant = () => {
    if (newTenantId.trim() && !formData.tenantIds.includes(newTenantId.trim())) {
      setFormData({
        ...formData,
        tenantIds: [...formData.tenantIds, newTenantId.trim()],
      });
      setNewTenantId('');
    }
  };

  const handleRemoveTenant = (tenantId: string) => {
    setFormData({
      ...formData,
      tenantIds: formData.tenantIds.filter(id => id !== tenantId),
    });
  };

  const handleSave = async () => {
    if (!formData.email.trim()) {
      showToast("error", "Validation", "Email is required");
      return;
    }

    try {
      if (editingEntry) {
        // Update existing - for now we'll use the replace tenants endpoint
        if (formData.tenantIds.length !== editingEntry.tenantIds.length || 
            !formData.tenantIds.every(id => editingEntry.tenantIds.includes(id))) {
          await apiCall(`/admin/allowlist/${editingEntry.id}/tenants`, {
            method: 'POST',
            body: JSON.stringify({ tenantIds: formData.tenantIds }),
          });
        }
        showToast("success", "Success", "Allowlist entry updated successfully");
      } else {
        await apiCall('/admin/allowlist', {
          method: 'POST',
          body: JSON.stringify({
            email: formData.email.trim(),
            mode: formData.mode,
            role: formData.role,
            notes: formData.notes,
            tenantIds: formData.tenantIds,
          }),
        });
        showToast("success", "Success", "Allowlist entry created successfully");
      }
      setDialogOpen(false);
      loadEntries();
    } catch (e: any) {
      showToast("error", "Error", e.message || "Failed to save allowlist entry. This operation requires system admin access.");
    }
  };

  const handleToggleStatus = async (entry: AllowlistEntry) => {
    try {
      const newStatus = entry.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
      const endpoint = entry.status === 'ACTIVE' ? 'disable' : 'enable';
      await apiCall(`/admin/allowlist/${entry.id}/${endpoint}`, {
        method: 'POST',
      });
      showToast("success", "Success", `Entry ${newStatus.toLowerCase()} successfully`);
      loadEntries();
    } catch (e: any) {
      showToast("error", "Error", e.message || "Failed to update entry status");
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.entry) return;

    try {
      await handleToggleStatus(deleteDialog.entry);
      setDeleteDialog({ open: false, entry: null });
    } catch (e: any) {
      showToast("error", "Error", e.message || "Failed to delete entry");
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'SYSTEM_ADMIN':
      case 'ADMIN':
        return 'System Admin';
      case 'SYSTEM_ANALYST':
      case 'ANALYST':
        return 'System Analyst';
      case 'SYSTEM_VIEWER':
      case 'VIEWER':
        return 'System Viewer';
      default:
        return role;
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-[1600px] mx-auto">
        <div className="mb-6">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Card className="p-6">
          <Skeleton className="h-64" />
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-[1600px] mx-auto">
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error.message || 'An error occurred while loading allowlist entries.'}
            <br />
            <span className="text-xs mt-2 block">
              Note: This page requires system administrator access. The allowlist management API currently uses an admin key for authentication.
            </span>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/admin">Administration</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Global Users</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#1E1E1E] mb-2 flex items-center gap-2">
            <Users className="w-6 h-6 text-[#0052CC]" />
            System Access
          </h1>
          <p className="text-gray-600">
            Grant system-level access to users (SYSTEM_ADMIN, SYSTEM_ANALYST, SYSTEM_VIEWER). 
            These users can access multiple or all tenants. For tenant-specific users, use "Team Members" in the tenant admin section.
          </p>
        </div>
        <Button onClick={handleAdd} className="rounded-sm">
          <Plus className="w-4 h-4 mr-2" />
          Add User
        </Button>
      </div>

      <Card className="rounded-sm">
        {entries.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">No allowlist entries found</p>
            <p className="text-sm text-gray-400 mb-4">Add users to the system allowlist to grant access</p>
            <Button onClick={handleAdd} variant="outline" className="rounded-sm">
              <Plus className="w-4 h-4 mr-2" />
              Add User
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Tenants</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span className="font-medium">{entry.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="rounded-sm">
                      {getRoleLabel(entry.role)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="rounded-sm">
                      {entry.mode === 'MULTI_TENANT' ? 'Multi-Tenant' : 'Single Tenant'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {entry.tenantIds.length === 0 ? (
                        <span className="text-xs text-gray-400">All tenants</span>
                      ) : (
                        entry.tenantIds.slice(0, 3).map((tid) => (
                          <Badge key={tid} variant="outline" className="rounded-sm text-xs">
                            <Building2 className="w-3 h-3 mr-1" />
                            {tid}
                          </Badge>
                        ))
                      )}
                      {entry.tenantIds.length > 3 && (
                        <Badge variant="outline" className="rounded-sm text-xs">
                          +{entry.tenantIds.length - 3}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={entry.status === 'ACTIVE' ? 'default' : 'secondary'} className="rounded-sm">
                      {entry.status === 'ACTIVE' ? (
                        <>
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Active
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3 mr-1" />
                          Disabled
                        </>
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {new Date(entry.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(entry)}
                        className="rounded-sm"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleStatus(entry)}
                        className="rounded-sm"
                      >
                        {entry.status === 'ACTIVE' ? (
                          <XCircle className="w-4 h-4 text-orange-600" />
                        ) : (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-sm max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingEntry ? 'Edit Allowlist Entry' : 'Add User to Allowlist'}</DialogTitle>
            <DialogDescription>
              {editingEntry ? 'Update user access settings' : 'Grant system-level access to a user'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                disabled={!!editingEntry}
                className="rounded-sm"
                placeholder="user@example.com"
              />
              {editingEntry && (
                <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
              )}
            </div>
            <div>
              <Label htmlFor="role">Role</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value as any })}
              >
                <SelectTrigger className="rounded-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SYSTEM_ADMIN">System Admin</SelectItem>
                  <SelectItem value="SYSTEM_ANALYST">System Analyst</SelectItem>
                  <SelectItem value="SYSTEM_VIEWER">System Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="mode">Access Mode</Label>
              <Select
                value={formData.mode}
                onValueChange={(value) => setFormData({ ...formData, mode: value as any })}
              >
                <SelectTrigger className="rounded-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SINGLE_TENANT">Single Tenant</SelectItem>
                  <SelectItem value="MULTI_TENANT">Multi-Tenant</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Allowed Tenants</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={newTenantId}
                  onChange={(e) => setNewTenantId(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddTenant()}
                  className="rounded-sm"
                  placeholder="Enter tenant ID"
                  list="tenant-list"
                />
                <datalist id="tenant-list">
                  {availableTenants.map(tid => (
                    <option key={tid} value={tid} />
                  ))}
                </datalist>
                <Button type="button" onClick={handleAddTenant} variant="outline" className="rounded-sm">
                  Add
                </Button>
              </div>
              {formData.tenantIds.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.tenantIds.map((tid) => (
                    <Badge key={tid} variant="outline" className="rounded-sm">
                      {tid}
                      <button
                        type="button"
                        onClick={() => handleRemoveTenant(tid)}
                        className="ml-2 hover:text-red-600"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Leave empty to grant access to all tenants (SYSTEM_ADMIN only)
              </p>
            </div>
            <div>
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="rounded-sm"
                placeholder="Internal notes about this user"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-sm">
              Cancel
            </Button>
            <Button onClick={handleSave} className="rounded-sm">
              {editingEntry ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, entry: null })}>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Disable Allowlist Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to disable access for "{deleteDialog.entry?.email}"? 
              This will prevent them from accessing the system. This action can be reversed later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-sm">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="rounded-sm bg-red-600 hover:bg-red-700">
              Disable
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
