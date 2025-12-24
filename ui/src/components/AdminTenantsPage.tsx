import { useState, useEffect } from "react";
import { Building2, Plus, Edit, Trash2, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "./ToastProvider";
import { tenantApi } from "../services/apiService";
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

type Tenant = {
  tenantId: string;
  tenantName: string;
  name?: string;
  status: string;
  currency: string;
  createdAt: string;
  updatedAt: string;
};

export default function AdminTenantsPage() {
  const { showToast } = useToast();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ type: 'network' | 'system'; message?: string } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; tenant: Tenant | null }>({
    open: false,
    tenant: null,
  });
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [formData, setFormData] = useState({
    tenantId: '',
    name: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
    currency: 'USD' as 'USD' | 'ILS' | 'EUR',
  });

  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await tenantApi.list();
      // Normalize tenant data
      const normalized = data.map(t => ({
        ...t,
        name: t.tenantName || t.name || t.tenantId,
      }));
      setTenants(normalized);
    } catch (e: any) {
      const isNetworkError = e.message?.includes('fetch') || e.message?.includes('network') || e.message?.includes('Failed to fetch');
      setError({
        type: isNetworkError ? 'network' : 'system',
        message: e.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingTenant(null);
    setFormData({ tenantId: '', name: '', status: 'ACTIVE', currency: 'USD' });
    setDialogOpen(true);
  };

  const handleEdit = (tenant: Tenant) => {
    setEditingTenant(tenant);
    setFormData({
      tenantId: tenant.tenantId,
      name: tenant.name || tenant.tenantName || tenant.tenantId,
      status: tenant.status as 'ACTIVE' | 'INACTIVE',
      currency: tenant.currency as 'USD' | 'ILS' | 'EUR',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.tenantId.trim() || !formData.name.trim()) {
      showToast("error", "Validation", "Tenant ID and name are required");
      return;
    }

    try {
      if (editingTenant) {
        await tenantApi.update(editingTenant.tenantId, {
          name: formData.name,
          status: formData.status,
          currency: formData.currency,
        });
        showToast("success", "Success", "Tenant updated successfully");
      } else {
        await tenantApi.create(formData.tenantId.trim(), formData.name.trim(), formData.status, formData.currency);
        showToast("success", "Success", "Tenant created successfully");
      }
      setDialogOpen(false);
      loadTenants();
    } catch (e: any) {
      showToast("error", "Error", e.message || "Failed to save tenant");
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.tenant) return;

    try {
      await tenantApi.delete(deleteDialog.tenant.tenantId);
      showToast("success", "Success", "Tenant deactivated successfully");
      setDeleteDialog({ open: false, tenant: null });
      loadTenants();
    } catch (e: any) {
      showToast("error", "Error", e.message || "Failed to delete tenant");
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
            {error.type === 'network' 
              ? 'Network error. Please check your connection and try again.'
              : error.message || 'An error occurred while loading tenants.'}
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
            <BreadcrumbPage>Tenants</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#1E1E1E] mb-2 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-[#0052CC]" />
            Manage Tenants
          </h1>
          <p className="text-gray-600">
            Create, edit, and deactivate tenant entities. This manages the tenant objects themselves, not their settings.
          </p>
        </div>
        <Button onClick={handleAdd} className="rounded-sm">
          <Plus className="w-4 h-4 mr-2" />
          Create Tenant
        </Button>
      </div>

      <Card className="rounded-sm">
        {tenants.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">No tenants found</p>
            <p className="text-sm text-gray-400 mb-4">Create your first tenant to get started</p>
            <Button onClick={handleAdd} variant="outline" className="rounded-sm">
              <Plus className="w-4 h-4 mr-2" />
              Create Tenant
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((tenant) => (
                <TableRow key={tenant.tenantId}>
                  <TableCell className="font-mono text-sm">{tenant.tenantId}</TableCell>
                  <TableCell className="font-medium">{tenant.name || tenant.tenantName}</TableCell>
                  <TableCell>
                    <Badge variant={tenant.status === 'ACTIVE' ? 'default' : 'secondary'} className="rounded-sm">
                      {tenant.status === 'ACTIVE' ? (
                        <>
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Active
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3 mr-1" />
                          Inactive
                        </>
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell>{tenant.currency}</TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {new Date(tenant.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(tenant)}
                        className="rounded-sm"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteDialog({ open: true, tenant })}
                        className="rounded-sm text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
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
        <DialogContent className="rounded-sm">
          <DialogHeader>
            <DialogTitle>{editingTenant ? 'Edit Tenant' : 'Create Tenant'}</DialogTitle>
            <DialogDescription>
              {editingTenant ? 'Update tenant information' : 'Create a new tenant in the system'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="tenantId">Tenant ID</Label>
              <Input
                id="tenantId"
                value={formData.tenantId}
                onChange={(e) => setFormData({ ...formData, tenantId: e.target.value })}
                disabled={!!editingTenant}
                className="rounded-sm"
                placeholder="default"
              />
              {editingTenant && (
                <p className="text-xs text-gray-500 mt-1">Tenant ID cannot be changed</p>
              )}
            </div>
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="rounded-sm"
                placeholder="My Tenant"
              />
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value as 'ACTIVE' | 'INACTIVE' })}
              >
                <SelectTrigger className="rounded-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="currency">Currency</Label>
              <Select
                value={formData.currency}
                onValueChange={(value) => setFormData({ ...formData, currency: value as 'USD' | 'ILS' | 'EUR' })}
              >
                <SelectTrigger className="rounded-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="ILS">ILS</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-sm">
              Cancel
            </Button>
            <Button onClick={handleSave} className="rounded-sm">
              {editingTenant ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, tenant: null })}>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Tenant</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate "{deleteDialog.tenant?.name || deleteDialog.tenant?.tenantId}"? 
              This will set the tenant status to INACTIVE. This action can be reversed later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-sm">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="rounded-sm bg-red-600 hover:bg-red-700">
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
