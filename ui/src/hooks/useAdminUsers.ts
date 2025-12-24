import { useState, useEffect } from "react";
import { adminApi } from "../services/adminApi";
import type { TenantUser, TenantInvite, InviteUserRequest } from "../types/admin";
import { useToast } from "../components/ToastProvider";

export function useAdminUsers(tenantId: string) {
  const { showToast } = useToast();
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [invites, setInvites] = useState<TenantInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [usersData, invitesData] = await Promise.all([
        adminApi.getUsers(tenantId),
        adminApi.getInvites(tenantId),
      ]);
      setUsers(usersData);
      setInvites(invitesData);
    } catch (err: any) {
      setError(err.message || "Failed to load users");
      showToast("error", "Error", err.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tenantId) {
      loadData();
    }
  }, [tenantId]);

  const inviteUser = async (request: InviteUserRequest) => {
    try {
      const invite = await adminApi.inviteUser(tenantId, request);
      setInvites(prev => [...prev, invite]);
      showToast("success", "Invitation sent", `Invitation sent to ${request.email}`);
      return invite;
    } catch (err: any) {
      showToast("error", "Error", err.message || "Failed to send invitation");
      throw err;
    }
  };

  const deleteInvite = async (inviteId: string) => {
    try {
      await adminApi.deleteInvite(tenantId, inviteId);
      setInvites(prev => prev.filter(i => i.id !== inviteId));
      showToast("success", "Invitation revoked", "Invitation has been revoked");
    } catch (err: any) {
      showToast("error", "Error", err.message || "Failed to revoke invitation");
      throw err;
    }
  };

  const updateUserRole = async (userId: string, role: string) => {
    try {
      await adminApi.updateUserRole(tenantId, userId, { role: role as any });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: role as any } : u));
      showToast("success", "Role updated", "User role has been updated");
    } catch (err: any) {
      showToast("error", "Error", err.message || "Failed to update role");
      throw err;
    }
  };

  const updateUserStatus = async (userId: string, status: "ACTIVE" | "DISABLED") => {
    try {
      await adminApi.updateUserStatus(tenantId, userId, { status });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, status } : u));
      showToast("success", "Status updated", `User has been ${status.toLowerCase()}`);
    } catch (err: any) {
      showToast("error", "Error", err.message || "Failed to update status");
      throw err;
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      await adminApi.deleteUser(tenantId, userId);
      setUsers(prev => prev.filter(u => u.id !== userId));
      showToast("success", "User removed", "User has been removed from tenant");
    } catch (err: any) {
      showToast("error", "Error", err.message || "Failed to remove user");
      throw err;
    }
  };

  return {
    users,
    invites,
    loading,
    error,
    inviteUser,
    deleteInvite,
    updateUserRole,
    updateUserStatus,
    deleteUser,
    reload: loadData,
  };
}

