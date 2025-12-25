import React, { useState, useEffect } from "react";
import { Users, Plus, Edit, CheckCircle, XCircle, Building2, Mail, ChevronRight } from "lucide-react";
import { useToast } from "./ToastProvider";
import { apiCall } from "../services/apiService";
import { tenantApi } from "../services/apiService";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

type AllowlistEntry = {
  id: string;
  email: string;
  issuer?: string;
  subject?: string;
  status: 'ACTIVE' | 'DISABLED';
  mode: 'SINGLE_TENANT' | 'MULTI_TENANT';
  role: 'SYSTEM_ADMIN' | 'SYSTEM_ANALYST' | 'SYSTEM_VIEWER' | 'ADMIN' | 'ANALYST' | 'VIEWER' | null;
  tenantIds: string[];
  createdAt: string;
  notes?: string;
};

type TenantMembership = {
  tenantId: string;
  tenantName: string;
  role: string;
  status: string;
};

export default function AdminUsersPage() {
  const { showToast } = useToast();
  const [entries, setEntries] = useState<AllowlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ type: 'network' | 'system'; message?: string } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [userDetailsOpen, setUserDetailsOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AllowlistEntry | null>(null);
  const [userTenantMemberships, setUserTenantMemberships] = useState<TenantMembership[]>([]);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; entry: AllowlistEntry | null }>({
    open: false,
    entry: null,
  });
  const [editingEntry, setEditingEntry] = useState<AllowlistEntry | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    systemRole: 'SYSTEM_ADMIN' as 'SYSTEM_ADMIN' | 'SYSTEM_ANALYST' | 'SYSTEM_VIEWER' | null,
    tenantIds: [] as string[],
    status: 'ACTIVE' as 'ACTIVE' | 'DISABLED',
    notes: '',
  });
  const [availableTenants, setAvailableTenants] = useState<Array<{ tenantId: string; name: string }>>([]);
  const [newTenantId, setNewTenantId] = useState('');

  useEffect(() => {
    loadEntries();
    loadTenants();
  }, []);

  const loadTenants = async () => {
    try {
      const tenants = await tenantApi.list();
      const tenantList = tenants.map((t: any) => ({
        tenantId: t.tenantId || t.tenant_id,
        name: t.tenantName || t.name || t.tenantId,
      }));
      setAvailableTenants(tenantList);
    } catch (e) {
      console.error("Failed to load tenants:", e);
    }
  };

  const loadEntries = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiCall<AllowlistEntry[]>('/admin/allowlist');
      setEntries(data);
    } catch (e: any) {
      const isNetworkError = e.message?.includes('fetch') || e.message?.includes('network') || e.message?.includes('Failed to fetch');
      setError({
        type: isNetworkError ? 'network' : 'system',
        message: e.message || 'Failed to load users. System administrator access required.',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadUserTenantMemberships = async (email: string) => {
    // This would need a backend endpoint to get tenant memberships for a user
    // For now, we'll show a placeholder
    setUserTenantMemberships([]);
  };

  const handleAdd = () => {
    setEditingEntry(null);
    setFormData({
      email: '',
      systemRole: 'SYSTEM_ADMIN',
      tenantIds: [],
      status: 'ACTIVE',
      notes: '',
    });
    setNewTenantId('');
    setDialogOpen(true);
  };

  const normalizeRole = (role: string | null | undefined): 'SYSTEM_ADMIN' | 'SYSTEM_ANALYST' | 'SYSTEM_VIEWER' | null => {
    if (!role) return null;
    switch (role) {
      case 'SYSTEM_ADMIN':
      case 'ADMIN':
        return 'SYSTEM_ADMIN';
      case 'SYSTEM_ANALYST':
      case 'ANALYST':
        return 'SYSTEM_ANALYST';
      case 'SYSTEM_VIEWER':
      case 'VIEWER':
        return 'SYSTEM_VIEWER';
      default:
        return null;
    }
  };

  const handleEdit = (entry: AllowlistEntry) => {
    setEditingEntry(entry);
    setFormData({
      email: entry.email,
      systemRole: normalizeRole(entry.role),
      tenantIds: [...entry.tenantIds],
      status: entry.status,
      notes: entry.notes || '',
    });
    setNewTenantId('');
    setDialogOpen(true);
  };

  const handleViewDetails = async (entry: AllowlistEntry) => {
    setSelectedUser(entry);
    await loadUserTenantMemberships(entry.email);
    setUserDetailsOpen(true);
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
        // Update existing
        if (formData.tenantIds.length !== editingEntry.tenantIds.length || 
            !formData.tenantIds.every(id => editingEntry.tenantIds.includes(id))) {
          await apiCall(`/admin/allowlist/${editingEntry.id}/tenants`, {
            method: 'POST',
            body: JSON.stringify({ tenantIds: formData.tenantIds }),
          });
        }
        showToast("success", "Success", "User updated successfully");
      } else {
        // Determine mode based on tenantIds
        const mode = formData.tenantIds.length === 0 ? 'MULTI_TENANT' : 
                    formData.tenantIds.length === 1 ? 'SINGLE_TENANT' : 'MULTI_TENANT';
        
        await apiCall('/admin/allowlist', {
          method: 'POST',
          body: JSON.stringify({
            email: formData.email.trim(),
            mode: mode,
            role: formData.systemRole || 'SYSTEM_VIEWER',
            notes: formData.notes,
            tenantIds: formData.tenantIds,
          }),
        });
        showToast("success", "Success", "User added successfully");
      }
      setDialogOpen(false);
      loadEntries();
    } catch (e: any) {
      showToast("error", "Error", e.message || "Failed to save user. System administrator access required.");
    }
  };

  const handleToggleStatus = async (entry: AllowlistEntry) => {
    try {
      const endpoint = entry.status === 'ACTIVE' ? 'disable' : 'enable';
      await apiCall(`/admin/allowlist/${entry.id}/${endpoint}`, {
        method: 'POST',
      });
      showToast("success", "Success", `User ${entry.status === 'ACTIVE' ? 'disabled' : 'enabled'} successfully`);
      loadEntries();
    } catch (e: any) {
      showToast("error", "Error", e.message || "Failed to update user status");
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.entry) return;
    await handleToggleStatus(deleteDialog.entry);
    setDeleteDialog({ open: false, entry: null });
  };

  const getRoleLabel = (role: string | null) => {
    if (!role) return 'None';
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

  const getStatusBadge = (status: string) => {
    return status === 'ACTIVE' ? (
      <Badge className="bg-green-100 text-green-800 border-0 rounded-sm">
        <CheckCircle className="w-3 h-3 mr-1" />
        Active
      </Badge>
    ) : (
      <Badge className="bg-red-100 text-red-800 border-0 rounded-sm">
        <XCircle className="w-3 h-3 mr-1" />
        Disabled
      </Badge>
    );
  };

  if (loading) {
    return (
      <div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          {error.message || 'An error occurred while loading users.'}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-xl font-semibold text-[#1E1E1E] mb-1">Users</h2>
            <p className="text-sm text-gray-600">
              Manage system-level user access. Users with system roles can access multiple or all tenants.
            </p>
          </div>
          <Badge variant="outline" className="rounded-sm">System-level</Badge>
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
            <p className="text-gray-500 mb-2">No users found</p>
            <p className="text-sm text-gray-400 mb-4">Add users to grant system-level access</p>
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
                <TableHead>System Role</TableHead>
                <TableHead>Tenants</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow 
                  key={entry.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => handleViewDetails(entry)}
                >
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
                    {entry.tenantIds.length === 0 ? (
                      <span className="text-sm text-gray-500">All tenants</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {entry.tenantIds.slice(0, 2).map((tid) => (
                          <Badge key={tid} variant="outline" className="rounded-sm text-xs">
                            {tid}
                          </Badge>
                        ))}
                        {entry.tenantIds.length > 2 && (
                          <Badge variant="outline" className="rounded-sm text-xs">
                            +{entry.tenantIds.length - 2}
                          </Badge>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(entry.status)}
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {new Date(entry.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
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

      {/* Add/Edit User Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-sm max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingEntry ? 'Edit User' : 'Add User'}</DialogTitle>
            <DialogDescription>
              {editingEntry ? 'Update system-level access settings' : 'Grant system-level access to a user'}
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
              <Label htmlFor="systemRole">System Role</Label>
              <Select
                value={formData.systemRole || 'none'}
                onValueChange={(value) => setFormData({ ...formData, systemRole: value === 'none' ? null : value as any })}
              >
                <SelectTrigger className="rounded-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="SYSTEM_ADMIN">System Admin</SelectItem>
                  <SelectItem value="SYSTEM_ANALYST">System Analyst</SelectItem>
                  <SelectItem value="SYSTEM_VIEWER">System Viewer</SelectItem>
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
                  {availableTenants.map(t => (
                    <option key={t.tenantId} value={t.tenantId} />
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
              {editingEntry ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Details Dialog */}
      <Dialog open={userDetailsOpen} onOpenChange={setUserDetailsOpen}>
        <DialogContent className="rounded-sm max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>
              {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <Tabs defaultValue="profile" className="w-full">
              <TabsList className="rounded-sm">
                <TabsTrigger value="profile">Profile</TabsTrigger>
                <TabsTrigger value="memberships">Tenant Memberships</TabsTrigger>
                <TabsTrigger value="system">System Role</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
              </TabsList>
              <TabsContent value="profile" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-gray-500">Email</Label>
                    <p className="text-sm font-medium">{selectedUser.email}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Created</Label>
                    <p className="text-sm">{new Date(selectedUser.createdAt).toLocaleString()}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Status</Label>
                    <div className="mt-1">{getStatusBadge(selectedUser.status)}</div>
                  </div>
                  {selectedUser.issuer && (
                    <div>
                      <Label className="text-xs text-gray-500">Issuer</Label>
                      <p className="text-sm font-mono text-xs">{selectedUser.issuer}</p>
                    </div>
                  )}
                </div>
                {selectedUser.notes && (
                  <div>
                    <Label className="text-xs text-gray-500">Notes</Label>
                    <p className="text-sm mt-1">{selectedUser.notes}</p>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="memberships" className="mt-4">
                {userTenantMemberships.length === 0 ? (
                  <p className="text-sm text-gray-500">No tenant memberships found</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tenant</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {userTenantMemberships.map((membership) => (
                        <TableRow key={membership.tenantId}>
                          <TableCell>{membership.tenantName}</TableCell>
                          <TableCell>{membership.role}</TableCell>
                          <TableCell>{membership.status}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
              <TabsContent value="system" className="mt-4 space-y-4">
                <div>
                  <Label className="text-xs text-gray-500">System Role</Label>
                  <p className="text-sm font-medium mt-1">{getRoleLabel(selectedUser.role)}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Access Mode</Label>
                  <p className="text-sm mt-1">
                    {selectedUser.mode === 'MULTI_TENANT' ? 'Multi-Tenant' : 'Single Tenant'}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Allowed Tenants</Label>
                  {selectedUser.tenantIds.length === 0 ? (
                    <p className="text-sm mt-1 text-gray-500">All tenants</p>
                  ) : (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedUser.tenantIds.map((tid) => (
                        <Badge key={tid} variant="outline" className="rounded-sm">
                          {tid}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
              <TabsContent value="activity" className="mt-4">
                <p className="text-sm text-gray-500">Activity log coming soon</p>
              </TabsContent>
            </Tabs>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserDetailsOpen(false)} className="rounded-sm">
              Close
            </Button>
            {selectedUser && (
              <Button onClick={() => {
                setUserDetailsOpen(false);
                handleEdit(selectedUser);
              }} className="rounded-sm">
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, entry: null })}>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Disable User</AlertDialogTitle>
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
