import { useState, useEffect } from "react";
import { adminApi } from "../services/adminApi";
import type { TenantSettings } from "../types/admin";
import { useToast } from "../components/ToastProvider";

export function useTenantSettings(tenantId: string) {
  const { showToast } = useToast();
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (tenantId) {
      loadSettings();
    }
  }, [tenantId]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminApi.getSettings(tenantId);
      setSettings(data);
      setDirty(false);
    } catch (err: any) {
      setError(err.message || "Failed to load settings");
      showToast("error", "Error", err.message || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = (updates: Partial<TenantSettings>) => {
    if (settings) {
      setSettings({ ...settings, ...updates });
      setDirty(true);
    }
  };

  const saveSettings = async () => {
    if (!settings || !dirty) return;

    try {
      setSaving(true);
      const saved = await adminApi.updateSettings(tenantId, settings);
      setSettings(saved);
      setDirty(false);
      showToast("success", "Settings saved", "Tenant settings have been saved");
    } catch (err: any) {
      showToast("error", "Error", err.message || "Failed to save settings");
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const discardChanges = () => {
    loadSettings();
  };

  return {
    settings,
    loading,
    error,
    dirty,
    saving,
    updateSettings,
    saveSettings,
    discardChanges,
    reload: loadSettings,
  };
}

