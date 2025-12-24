import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Loader2 } from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { componentGroupsApi, type ComponentGroup } from '../services/apiService';
import { useToast } from './ToastProvider';
import { StateScreen } from './ui/StateScreen';

export default function ComponentGroups({ tenantId = 'default' }: { tenantId?: string }) {
  const [componentGroups, setComponentGroups] = useState<ComponentGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [showDeleteGroupDialog, setShowDeleteGroupDialog] = useState(false);
  const [groupNameToDelete, setGroupNameToDelete] = useState<string | null>(null);
  const [editingGroup, setEditingGroup] = useState<ComponentGroup | null>(null);
  const [groupFormData, setGroupFormData] = useState({ 
    groupName: '', 
    displayName: '', 
    color: '#0052CC', 
    displayOrder: 1 
  });
  const { showToast } = useToast();

  // Load component groups on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const groups = await componentGroupsApi.getAll();
        if (!cancelled) {
          setComponentGroups(groups);
        }
      } catch (e: any) {
        if (!cancelled) {
          console.error('Failed to load component groups:', e);
          showToast('error', 'Failed to load groups', e.message || 'Unknown error');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [tenantId, showToast]);

  const handleSaveGroup = async () => {
    if (!groupFormData.groupName.trim()) {
      showToast('error', 'Validation error', 'Group name is required');
      return;
    }

    setSaving(true);
    try {
      if (editingGroup) {
        const newGroupName = groupFormData.groupName !== editingGroup.groupName 
          ? groupFormData.groupName 
          : null;
        await componentGroupsApi.update(
          editingGroup.groupName,
          newGroupName,
          groupFormData.displayName,
          groupFormData.color,
          groupFormData.displayOrder
        );
        showToast('success', 'Group updated', `Group "${groupFormData.groupName}" has been updated.`);
      } else {
        await componentGroupsApi.create(
          groupFormData.groupName,
          groupFormData.displayName,
          groupFormData.color,
          groupFormData.displayOrder
        );
        showToast('success', 'Group created', `Group "${groupFormData.groupName}" has been created.`);
      }
      
      // Reload groups
      const groups = await componentGroupsApi.getAll();
      setComponentGroups(groups);
      
      setShowGroupDialog(false);
      setEditingGroup(null);
      setGroupFormData({ groupName: '', displayName: '', color: '#0052CC', displayOrder: componentGroups.length + 1 });
    } catch (e: any) {
      showToast('error', 'Failed to save group', e.message || 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!groupNameToDelete) return;

      setSaving(true);
    try {
      await componentGroupsApi.delete(groupNameToDelete);
      showToast('success', 'Group deleted', `Group "${groupNameToDelete}" has been deleted.`);
      
      // Reload groups
      const groups = await componentGroupsApi.getAll();
      setComponentGroups(groups);
      
      setShowDeleteGroupDialog(false);
      setGroupNameToDelete(null);
    } catch (e: any) {
      showToast('error', 'Failed to delete group', e.message || 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#0052CC]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-[#1E1E1E]">Component Groups</h2>
        <Button
          onClick={() => {
            setEditingGroup(null);
            setGroupFormData({ groupName: '', displayName: '', color: '#0052CC', displayOrder: componentGroups.length + 1 });
            setShowGroupDialog(true);
          }}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Group
        </Button>
      </div>

      <Card className="p-6">
        <div className="space-y-4">
          {componentGroups.length === 0 ? (
            <StateScreen
              type="empty"
              title="No component groups"
              description="Component groups organize your salary components. Create your first group to get started."
              primaryActionLabel="Create Group"
              onPrimaryAction={() => {
                setEditingGroup(null);
                setGroupFormData({ groupName: '', displayName: '', color: '#0052CC', displayOrder: 1 });
                setShowGroupDialog(true);
              }}
              inline
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-[#1E1E1E]">Group Name</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-[#1E1E1E]">Display Name</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-[#1E1E1E]">Color</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-[#1E1E1E]">Display Order</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-[#1E1E1E]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {componentGroups.map((group) => (
                    <tr key={group.groupName} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm text-[#1E1E1E] font-mono">{group.groupName}</td>
                      <td className="py-3 px-4 text-sm text-[#1E1E1E]">{group.displayName}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded border border-gray-300"
                            style={{ backgroundColor: group.color }}
                          />
                          <span className="text-sm text-gray-600">{group.color}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-[#1E1E1E]">{group.displayOrder}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingGroup(group);
                              setGroupFormData({
                                groupName: group.groupName,
                                displayName: group.displayName,
                                color: group.color,
                                displayOrder: group.displayOrder,
                              });
                              setShowGroupDialog(true);
                            }}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setGroupNameToDelete(group.groupName);
                              setShowDeleteGroupDialog(true);
                            }}
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      {/* Add/Edit Group Dialog */}
      <Dialog open={showGroupDialog} onOpenChange={setShowGroupDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingGroup ? 'Edit Group' : 'Add Group'}</DialogTitle>
            <DialogDescription>
              {editingGroup ? 'Update the display name, color, or display order for this component group.' : 'Create a new component group to organize your salary components.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="groupName">Group Name</Label>
              <Input
                id="groupName"
                value={groupFormData.groupName}
                onChange={(e) => setGroupFormData({ ...groupFormData, groupName: e.target.value })}
                className="mt-1"
                placeholder="e.g., core, bonus"
              />
              <p className="text-xs text-gray-500 mt-1">Unique identifier for this component group</p>
            </div>
            <div>
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={groupFormData.displayName}
                onChange={(e) => setGroupFormData({ ...groupFormData, displayName: e.target.value })}
                className="mt-1"
                placeholder="e.g., Core Components"
              />
            </div>
            <div>
              <Label htmlFor="color">Color</Label>
              <Input
                id="color"
                type="color"
                value={groupFormData.color}
                onChange={(e) => setGroupFormData({ ...groupFormData, color: e.target.value })}
                className="mt-1 w-20 h-10"
              />
            </div>
            <div>
              <Label htmlFor="displayOrder">Display Order</Label>
              <Input
                id="displayOrder"
                type="number"
                min="1"
                value={groupFormData.displayOrder}
                onChange={(e) => setGroupFormData({ ...groupFormData, displayOrder: parseInt(e.target.value) || 1 })}
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">Lower numbers appear first (group1, group2, etc.)</p>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setShowGroupDialog(false);
                setEditingGroup(null);
                setGroupFormData({ groupName: '', displayName: '', color: '#0052CC', displayOrder: 1 });
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveGroup} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editingGroup ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Group Dialog */}
      <Dialog open={showDeleteGroupDialog} onOpenChange={setShowDeleteGroupDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Group</DialogTitle>
            <DialogDescription>
              This action cannot be undone. The component group will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-gray-600 mt-2">
            Are you sure you want to delete group "{groupNameToDelete}"? This action cannot be undone.
          </p>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteGroupDialog(false);
                setGroupNameToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteGroup}
              disabled={saving}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

