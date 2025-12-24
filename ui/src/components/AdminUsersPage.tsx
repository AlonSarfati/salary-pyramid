import { useState } from "react";
import { Link } from "react-router-dom";
import { useTenant } from "../App";
import { useAdminUsers } from "../hooks/useAdminUsers";
import { canManageUsers, canChangeUserRole, canModifyUser } from "../utils/permissions";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { Users, UserPlus, Mail, MoreVertical, Trash2, Ban, CheckCircle, HelpCircle, Clock } from "lucide-react";
import { useToast } from "./ToastProvider";
import type { TenantUser, TenantInvite, TenantUserRole } from "../types/admin";

const ROLE_DESCRIPTIONS: Record<TenantUserRole, string> = {
  ADMIN: "Full access to all tenant settings and user management",
  EDITOR: "Can create and edit content, but cannot manage users",
  VIEWER: "Read-only access to tenant data",
};

export default function AdminUsersPage() {
  const { tenantId } = useTenant();
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

  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<TenantUserRole>("EDITOR");
  const [inviting, setInviting] = useState(false);
  const [deleteUserDialog, setDeleteUserDialog] = useState<{ open: boolean; user: TenantUser | null }>({
    open: false,
    user: null,
  });

  const canManage = canManageUsers();

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
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* Breadcrumb */}
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/admin">Administration</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Users & Access</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#1E1E1E] mb-1">Users & Access</h1>
          <p className="text-sm text-gray-600">Manage user access and permissions for this tenant</p>
        </div>
        {canManage && (
          <Button
            onClick={() => setInviteDialogOpen(true)}
            className="bg-[#0052CC] hover:bg-[#003D99] text-white rounded-sm"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Invite User
          </Button>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <Alert variant="destructive" className="mb-6 rounded-sm">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Users Table */}
      <Card className="mb-6 rounded-sm border">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-[#1E1E1E] mb-4">Users</h2>
          
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12">
              <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500 mb-2">No users found</p>
              <p className="text-sm text-gray-400 mb-4">
                Start by inviting users to this tenant
              </p>
              {canManage && (
                <Button
                  onClick={() => setInviteDialogOpen(true)}
                  className="bg-[#0052CC] hover:bg-[#003D99] text-white rounded-sm"
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Invite First User
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b">
                  <TableHead className="rounded-none">Name</TableHead>
                  <TableHead className="rounded-none">Email</TableHead>
                  <TableHead className="rounded-none">Role</TableHead>
                  <TableHead className="rounded-none">Status</TableHead>
                  <TableHead className="rounded-none">Last Login</TableHead>
                  <TableHead className="rounded-none w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id} className="border-b">
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      {canManage && canChangeUserRole(user.role) ? (
                        <Select
                          value={user.role}
                          onValueChange={(value) => updateUserRole(user.id, value)}
                        >
                          <SelectTrigger className="w-[140px] h-7 rounded-sm border-gray-300">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.keys(ROLE_DESCRIPTIONS).map((role) => (
                              <SelectItem key={role} value={role}>
                                {role}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="flex items-center gap-2">
                          {getRoleBadge(user.role)}
                          <Tooltip>
                            <TooltipTrigger>
                              <HelpCircle className="h-3 w-3 text-gray-400" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">{ROLE_DESCRIPTIONS[user.role]}</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(user.status)}</TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {formatDate(user.lastLoginAt)}
                    </TableCell>
                    <TableCell>
                      {canModifyUser(user.role) && (
                        <div className="flex items-center gap-2">
                          {user.status === "ACTIVE" ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => updateUserStatus(user.id, "DISABLED")}
                                  className="h-7 w-7 p-0 rounded-sm"
                                >
                                  <Ban className="h-4 w-4 text-gray-600" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Disable user</TooltipContent>
                            </Tooltip>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => updateUserStatus(user.id, "ACTIVE")}
                                  className="h-7 w-7 p-0 rounded-sm"
                                >
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Enable user</TooltipContent>
                            </Tooltip>
                          )}
                          {user.role !== "ADMIN" && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDeleteUserDialog({ open: true, user })}
                                  className="h-7 w-7 p-0 rounded-sm text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Remove user</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </Card>

      {/* Pending Invites */}
      {invites.length > 0 && (
        <Card className="mb-6 rounded-sm border">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-[#1E1E1E] mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-gray-500" />
              Pending Invitations
            </h2>
            <div className="space-y-3">
              {invites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-sm bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="font-medium text-sm">{invite.email}</p>
                      <p className="text-xs text-gray-500">
                        {getRoleBadge(invite.role)} • Invited {formatDate(invite.invitedAt)}
                      </p>
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleResendInvite(invite)}
                        className="rounded-sm"
                      >
                        Resend
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteInvite(invite.id)}
                        className="rounded-sm text-red-600 hover:text-red-700"
                      >
                        Revoke
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Audit Log Placeholder */}
      <Card className="rounded-sm border">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-[#1E1E1E] mb-4">Audit Log</h2>
          <div className="text-center py-8 border border-dashed border-gray-300 rounded-sm">
            <p className="text-sm text-gray-500">Audit log coming soon</p>
            <p className="text-xs text-gray-400 mt-1">
              Track user actions and changes to tenant settings
            </p>
          </div>
        </div>
      </Card>

      {/* Invite User Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="rounded-sm">
          <DialogHeader>
            <DialogTitle>Invite User</DialogTitle>
            <DialogDescription>
              Send an invitation to join this tenant. The user will receive an email with instructions.
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
                placeholder="user@example.com"
                className="mt-1 rounded-sm"
              />
            </div>
            <div>
              <Label htmlFor="invite-role">Role</Label>
              <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as TenantUserRole)}>
                <SelectTrigger id="invite-role" className="mt-1 rounded-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_DESCRIPTIONS).map(([role, desc]) => (
                    <SelectItem key={role} value={role}>
                      <div>
                        <div className="font-medium">{role}</div>
                        <div className="text-xs text-gray-500">{desc}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setInviteDialogOpen(false)}
              className="rounded-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleInvite}
              disabled={inviting || !inviteEmail.trim()}
              className="bg-[#0052CC] hover:bg-[#003D99] text-white rounded-sm"
            >
              {inviting ? "Sending..." : "Send Invitation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <AlertDialog open={deleteUserDialog.open} onOpenChange={(open) => setDeleteUserDialog({ open, user: null })}>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {deleteUserDialog.user?.name} from this tenant? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-sm">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="bg-red-600 hover:bg-red-700 text-white rounded-sm"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
