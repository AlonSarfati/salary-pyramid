import { useState } from "react";
import { useTenant } from "../App";
import { useAdminUsers } from "../hooks/useAdminUsers";
import { canManageUsers, canChangeUserRole, canModifyUser } from "../utils/permissions";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { Users, UserPlus, Mail, MoreVertical, Trash2, Ban, CheckCircle, HelpCircle, Clock, Lock } from "lucide-react";
import { useToast } from "./ToastProvider";
import { getCapabilityRequirement } from "../utils/capabilities";
import type { TenantUser, TenantInvite, TenantUserRole } from "../types/admin";

const ROLE_DESCRIPTIONS: Record<TenantUserRole, string> = {
  ADMIN: "Full access to all tenant settings and user management",
  EDITOR: "Can create and edit content, but cannot manage users",
  VIEWER: "Read-only access to tenant data",
};

export default function AdminTenantMembersPage() {
  const { tenantId, tenants } = useTenant();
  const {
    users,
    invites,
    loading,
    error,
    inviteUser,
    deleteInvite,
    updateUserRole,
    updateUserStatus,
    deleteUser,
  } = useAdminUsers(tenantId);
  const { showToast } = useToast();

  const currentTenant = tenants.find(t => t.tenantId === tenantId);

  // Tenant context guardrail
  if (!tenantId || !currentTenant) {
    return (
      <div>
        <Card className="rounded-sm p-12 text-center">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-[#1E1E1E] mb-2">Select a tenant</h3>
          <p className="text-sm text-gray-500">
            Choose a tenant from the top-right switcher to manage team members.
          </p>
        </Card>
      </div>
    );
  }

  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<TenantUserRole>("EDITOR");
  const [inviting, setInviting] = useState(false);
  const [deleteUserDialog, setDeleteUserDialog] = useState<{ open: boolean; user: TenantUser | null }>({
    open: false,
    user: null,
  });

  const canManage = canManageUsers(tenantId);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      showToast("error", "Validation", "Email is required");
      return;
    }

    setInviting(true);
    try {
      await inviteUser({ email: inviteEmail.trim(), role: inviteRole });
      setInviteDialogOpen(false);
      setInviteEmail("");
      setInviteRole("EDITOR");
    } catch (err) {
      // Error already handled in hook
    } finally {
      setInviting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUserDialog.user) return;
    try {
      await deleteUser(deleteUserDialog.user.id);
      setDeleteUserDialog({ open: false, user: null });
    } catch (err) {
      // Error already handled
    }
  };

  const handleResendInvite = async (invite: TenantInvite) => {
    try {
      await inviteUser({ email: invite.email, role: invite.role });
      showToast("success", "Invitation resent", `Invitation resent to ${invite.email}`);
    } catch (err) {
      // Error already handled
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return <Badge className="bg-green-100 text-green-800 border-0 rounded-sm">Active</Badge>;
      case "DISABLED":
        return <Badge className="bg-red-100 text-red-800 border-0 rounded-sm">Disabled</Badge>;
      case "INVITED":
        return <Badge className="bg-yellow-100 text-yellow-800 border-0 rounded-sm">Invited</Badge>;
      default:
        return <Badge className="rounded-sm">{status}</Badge>;
    }
  };

  const getRoleBadge = (role: TenantUserRole) => {
    const colors: Record<TenantUserRole, string> = {
      ADMIN: "bg-blue-100 text-blue-800",
      EDITOR: "bg-gray-100 text-gray-800",
      VIEWER: "bg-gray-50 text-gray-600",
    };
    return <Badge className={`${colors[role]} border-0 rounded-sm`}>{role}</Badge>;
  };

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#1E1E1E] mb-1">Team Members</h2>
          <p className="text-sm text-gray-600">
            Users who can access <strong>this tenant</strong> (tenant memberships). 
            For system-level access across all tenants, use "Users" in the System menu.
          </p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Button 
                onClick={() => setInviteDialogOpen(true)} 
                disabled={!canManage}
                className="rounded-sm"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Invite Team Member
              </Button>
            </div>
          </TooltipTrigger>
          {!canManage && (
            <TooltipContent>
              <p>{getCapabilityRequirement("tenant.users.manage")}</p>
            </TooltipContent>
          )}
        </Tooltip>
      </div>

      {loading ? (
        <Card className="p-6">
          <Skeleton className="h-64" />
        </Card>
      ) : error ? (
        <Alert variant="destructive" className="rounded-sm">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : (
        <>
          {/* Users Table */}
          <Card className="rounded-sm mb-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Tenant Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead>Added</TableHead>
                  {canManage && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canManage ? 6 : 5} className="text-center py-8 text-gray-500">
                      No team members yet. Invite users to join this tenant.
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-[#0052CC] flex items-center justify-center text-white text-xs font-semibold">
                            {user.name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || "U"}
                          </div>
                          <div>
                            <div className="font-medium">{user.name || user.email}</div>
                            {user.name && user.email && (
                              <div className="text-xs text-gray-500">{user.email}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger>
                            {getRoleBadge(user.role as TenantUserRole)}
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{ROLE_DESCRIPTIONS[user.role as TenantUserRole]}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell>{getStatusBadge(user.status)}</TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {formatDate(user.lastLoginAt)}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {formatDate(user.createdAt)}
                      </TableCell>
                      {canManage ? (
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div>
                                  <Select
                                    value={user.role}
                                    onValueChange={(value) => updateUserRole(user.id, value as TenantUserRole)}
                                    disabled={!canChangeUserRole(user.role as TenantUserRole)}
                                  >
                                    <SelectTrigger className="w-32 rounded-sm">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="ADMIN">ADMIN</SelectItem>
                                      <SelectItem value="EDITOR">EDITOR</SelectItem>
                                      <SelectItem value="VIEWER">VIEWER</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </TooltipTrigger>
                              {!canChangeUserRole(user.role as TenantUserRole) && (
                                <TooltipContent>
                                  <p>{getCapabilityRequirement("tenant.users.manage")}</p>
                                </TooltipContent>
                              )}
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => updateUserStatus(user.id, user.status === "ACTIVE" ? "DISABLED" : "ACTIVE")}
                                    disabled={!canModifyUser(user.role as TenantUserRole)}
                                    className="rounded-sm"
                                  >
                                    {user.status === "ACTIVE" ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                                  </Button>
                                </div>
                              </TooltipTrigger>
                              {!canModifyUser(user.role as TenantUserRole) && (
                                <TooltipContent>
                                  <p>{getCapabilityRequirement("tenant.users.manage")}</p>
                                </TooltipContent>
                              )}
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDeleteUserDialog({ open: true, user })}
                                    disabled={!canModifyUser(user.role as TenantUserRole)}
                                    className="rounded-sm text-red-600 hover:text-red-700"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TooltipTrigger>
                              {!canModifyUser(user.role as TenantUserRole) && (
                                <TooltipContent>
                                  <p>{getCapabilityRequirement("tenant.users.manage")}</p>
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </div>
                        </TableCell>
                      ) : (
                        <TableCell className="text-right">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div>
                                <Lock className="w-4 h-4 text-gray-400 mx-auto" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{getCapabilityRequirement("tenant.users.manage")}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>

          {/* Pending Invites */}
          {invites.length > 0 && (
            <Card className="rounded-sm mb-6">
              <div className="p-4 border-b border-gray-200">
                <h3 className="font-semibold text-[#1E1E1E]">Pending Invitations</h3>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Invited</TableHead>
                    {canManage && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invites.map((invite) => (
                    <TableRow key={invite.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-gray-400" />
                          {invite.email}
                        </div>
                      </TableCell>
                      <TableCell>{getRoleBadge(invite.role as TenantUserRole)}</TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {formatDate(invite.invitedAt)}
                      </TableCell>
                      {canManage ? (
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleResendInvite(invite)}
                              className="rounded-sm"
                            >
                              Resend
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteInvite(invite.id)}
                              className="rounded-sm text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      ) : (
                        <TableCell className="text-right">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div>
                                <Lock className="w-4 h-4 text-gray-400 mx-auto" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{getCapabilityRequirement("tenant.users.manage")}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}

          {/* Audit Log Placeholder */}
          <Card className="rounded-sm">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-[#1E1E1E]">Audit Log</h3>
            </div>
            <div className="p-6 text-center text-gray-500">
              <Clock className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm">Audit log coming soon</p>
            </div>
          </Card>
        </>
      )}

      {/* Invite Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="rounded-sm">
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Invite a user to join this tenant. They will receive an invitation email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="rounded-sm"
                placeholder="user@example.com"
              />
            </div>
            <div>
              <Label htmlFor="invite-role">Role</Label>
              <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as TenantUserRole)}>
                <SelectTrigger id="invite-role" className="rounded-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">ADMIN</SelectItem>
                  <SelectItem value="EDITOR">EDITOR</SelectItem>
                  <SelectItem value="VIEWER">VIEWER</SelectItem>
                </SelectContent>
              </Select>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-4 h-4 text-gray-400 mt-1" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>{ROLE_DESCRIPTIONS[inviteRole]}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)} className="rounded-sm">
              Cancel
            </Button>
            <Button onClick={handleInvite} disabled={inviting} className="rounded-sm">
              {inviting ? "Inviting..." : "Send Invitation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <AlertDialog open={deleteUserDialog.open} onOpenChange={(open) => setDeleteUserDialog({ open, user: null })}>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {deleteUserDialog.user?.name || deleteUserDialog.user?.email} from this tenant?
              This action can be reversed later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-sm">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="rounded-sm bg-red-600 hover:bg-red-700">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

