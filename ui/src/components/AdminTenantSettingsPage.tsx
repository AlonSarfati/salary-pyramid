import { useState } from "react";
import { useTenant } from "../App";
import { useTenantSettings } from "../hooks/useTenantSettings";
import { canEditTenantSettings, isAdmin } from "../utils/permissions";
import { getCapabilityRequirement } from "../utils/capabilities";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Switch } from "./ui/switch";
import { Skeleton } from "./ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
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
import { Building2, Save, X, AlertTriangle, HelpCircle, Trash2, RotateCcw, Lock } from "lucide-react";
import { useToast } from "./ToastProvider";
import type { RoundingMode } from "../types/admin";

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Australia/Sydney",
];

const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "CNY", "AUD", "ILS"];

const LOCALES = [
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "he-IL", label: "Hebrew" },
  { value: "ar-SA", label: "Arabic" },
];

const ROUNDING_MODES: { value: RoundingMode; label: string }[] = [
  { value: "NONE", label: "No rounding" },
  { value: "NEAREST_0_5", label: "Round to nearest 0.5" },
  { value: "NEAREST_1", label: "Round to nearest 1" },
];

export default function AdminTenantSettingsPage() {
  const { tenantId, tenants } = useTenant();
  const {
    settings,
    loading,
    error,
    dirty,
    saving,
    updateSettings,
    saveSettings,
    discardChanges,
  } = useTenantSettings(tenantId);
  const { showToast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");

  const canEdit = canEditTenantSettings(tenantId);
  const admin = isAdmin();
  const currentTenant = tenants.find(t => t.tenantId === tenantId);

  // Tenant context guardrail
  if (!tenantId || !currentTenant) {
    return (
      <div>
        <Card className="rounded-sm p-12 text-center">
          <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-[#1E1E1E] mb-2">Select a tenant</h3>
          <p className="text-sm text-gray-500">
            Choose a tenant from the top-right switcher to manage settings.
          </p>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-12 w-full mb-6" />
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div>
        <Alert variant="destructive" className="rounded-sm">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Failed to load tenant settings</AlertDescription>
        </Alert>
      </div>
    );
  }

  const handleSave = async () => {
    try {
      await saveSettings();
      showToast("success", "Settings saved", "Tenant configuration has been updated successfully.");
    } catch (err) {
      showToast("error", "Save failed", "Failed to save tenant settings. Please try again.");
    }
  };

  const handleDiscard = () => {
    discardChanges();
    showToast("info", "Changes discarded", "All unsaved changes have been discarded.");
  };

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-[#1E1E1E] mb-1">Tenant Configuration</h2>
        <p className="text-sm text-gray-600">
          Configure settings for <strong>this tenant</strong> (timezone, currency, locale, exports, security, etc.). 
          To create or edit tenant entities, use "Tenants" in the System menu.
        </p>
      </div>

      {/* Read-only banner for non-admin users */}
      {!canEdit && (
        <Alert className="mb-6 rounded-sm bg-yellow-50 border-yellow-200">
          <Lock className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="text-yellow-800">Read-only access</AlertTitle>
          <AlertDescription className="text-yellow-700">
            You have VIEWER access. Admin permissions required to edit.
          </AlertDescription>
        </Alert>
      )}

      {/* Error Banner */}
      {error && (
        <Alert variant="destructive" className="mb-6 rounded-sm">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList className="rounded-sm">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="locale">Locale & Currency</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="exports">Exports & Retention</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="mt-6">
          <Card className="rounded-sm border p-6">
            <h2 className="text-lg font-semibold text-[#1E1E1E] mb-4">Tenant Profile</h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="tenant-name">Name</Label>
                <Input
                  id="tenant-name"
                  value={settings.name}
                  onChange={(e) => updateSettings({ name: e.target.value })}
                  disabled={!canEdit}
                  className="mt-1 rounded-sm"
                />
              </div>
              <div>
                <Label htmlFor="tenant-id">Tenant ID</Label>
                <Input
                  id="tenant-id"
                  value={settings.tenantId}
                  disabled
                  className="mt-1 rounded-sm bg-gray-50"
                />
                <p className="text-xs text-gray-500 mt-1">Tenant ID cannot be changed</p>
              </div>
              <div>
                <Label htmlFor="timezone">Timezone</Label>
                <Select
                  value={settings.timezone}
                  onValueChange={(value) => updateSettings({ timezone: value })}
                  disabled={!canEdit}
                >
                  <SelectTrigger id="timezone" className="mt-1 rounded-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">Affects all users on next login</p>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-gray-200 text-xs text-gray-500">
              Last updated: {settings.updatedAt ? new Date(settings.updatedAt).toLocaleString() : "—"}
            </div>
          </Card>
        </TabsContent>

        {/* Locale & Currency Tab */}
        <TabsContent value="locale" className="mt-6">
          <Card className="rounded-sm border p-6">
            <h2 className="text-lg font-semibold text-[#1E1E1E] mb-4">Locale & Currency</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="currency">Currency</Label>
                <Select
                  value={settings.currency}
                  onValueChange={(value) => updateSettings({ currency: value })}
                  disabled={!canEdit}
                >
                  <SelectTrigger id="currency" className="mt-1 rounded-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((curr) => (
                      <SelectItem key={curr} value={curr}>
                        {curr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">Default for new calculations</p>
              </div>
              <div>
                <Label htmlFor="locale">Locale</Label>
                <Select
                  value={settings.locale}
                  onValueChange={(value) => updateSettings({ locale: value })}
                  disabled={!canEdit}
                >
                  <SelectTrigger id="locale" className="mt-1 rounded-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCALES.map((loc) => (
                      <SelectItem key={loc.value} value={loc.value}>
                        {loc.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">Default for new calculations</p>
              </div>
              <div>
                <Label htmlFor="rounding">Rounding</Label>
                <Select
                  value={settings.rounding}
                  onValueChange={(value) => updateSettings({ rounding: value as RoundingMode })}
                  disabled={!canEdit}
                >
                  <SelectTrigger id="rounding" className="mt-1 rounded-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROUNDING_MODES.map((mode) => (
                      <SelectItem key={mode.value} value={mode.value}>
                        {mode.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">Default for new calculations</p>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-gray-200 text-xs text-gray-500">
              Last updated: {settings.updatedAt ? new Date(settings.updatedAt).toLocaleString() : "—"}
            </div>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="mt-6">
          <Card className="rounded-sm border p-6">
            <h2 className="text-lg font-semibold text-[#1E1E1E] mb-4">Security</h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="session-timeout">Session Timeout (minutes)</Label>
                <Input
                  id="session-timeout"
                  type="number"
                  value={settings.sessionTimeoutMinutes}
                  onChange={(e) => updateSettings({ sessionTimeoutMinutes: parseInt(e.target.value) || 30 })}
                  disabled={!canEdit}
                  className="mt-1 rounded-sm"
                  min="5"
                  max="1440"
                />
                <p className="text-xs text-gray-500 mt-1">Affects all users on next login</p>
              </div>
              <div>
                <Label htmlFor="email-domains">Allowed Email Domains</Label>
                <Input
                  id="email-domains"
                  value={settings.allowedEmailDomains.join(", ")}
                  onChange={(e) => {
                    const domains = e.target.value.split(",").map(d => d.trim()).filter(Boolean);
                    updateSettings({ allowedEmailDomains: domains });
                  }}
                  disabled={!canEdit}
                  placeholder="example.com, company.com"
                  className="mt-1 rounded-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Comma-separated list of allowed email domains. Leave empty to allow all domains.
                </p>
              </div>
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="require-sso">Require SSO</Label>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-4 w-4 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Enforced at login. Requires Keycloak SSO setup.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Switch
                        id="require-sso"
                        checked={settings.requireSso}
                        onCheckedChange={(checked) => updateSettings({ requireSso: checked })}
                        disabled={!admin || !canEdit}
                        className="rounded-sm"
                      />
                    </div>
                  </TooltipTrigger>
                  {!admin && (
                    <TooltipContent>
                      <p>{getCapabilityRequirement("tenant.danger.delete")}</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </div>
              {!admin && (
                <p className="text-xs text-gray-500">Only SYSTEM_ADMIN can change SSO settings</p>
              )}
            </div>
            <div className="mt-6 pt-4 border-t border-gray-200 text-xs text-gray-500">
              Last updated: {settings.updatedAt ? new Date(settings.updatedAt).toLocaleString() : "—"}
            </div>
          </Card>
        </TabsContent>

        {/* Exports & Retention Tab */}
        <TabsContent value="exports" className="mt-6">
          <Card className="rounded-sm border p-6">
            <h2 className="text-lg font-semibold text-[#1E1E1E] mb-4">Exports & Retention</h2>
            <div className="space-y-4">
              <div>
                <Label className="mb-3 block">Export Formats</Label>
                <div className="space-y-2">
                  {(["csv", "xlsx", "pdf"] as const).map((format) => (
                    <div key={format} className="flex items-center justify-between py-2">
                      <Label htmlFor={`export-${format}`} className="font-normal">
                        {format.toUpperCase()}
                      </Label>
                      <Switch
                        id={`export-${format}`}
                        checked={settings.exports[format]}
                        onCheckedChange={(checked) =>
                          updateSettings({
                            exports: { ...settings.exports, [format]: checked },
                          })
                        }
                        disabled={!canEdit}
                        className="rounded-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="retention-days">Data Retention (days)</Label>
                <Input
                  id="retention-days"
                  type="number"
                  value={settings.retentionDays}
                  onChange={(e) => updateSettings({ retentionDays: parseInt(e.target.value) || 90 })}
                  disabled={!canEdit}
                  className="mt-1 rounded-sm"
                  min="1"
                  max="3650"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Controls how long exports/results are kept
                </p>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-gray-200 text-xs text-gray-500">
              Last updated: {settings.updatedAt ? new Date(settings.updatedAt).toLocaleString() : "—"}
            </div>
          </Card>
        </TabsContent>

        {/* Advanced / Danger Zone Tab */}
        <TabsContent value="advanced" className="mt-6">
          {admin ? (
            <Card className="rounded-sm border border-red-200 p-6">
              <h2 className="text-lg font-semibold text-red-600 mb-4 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Danger Zone
              </h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-red-200 rounded-sm bg-red-50">
                  <div>
                    <p className="font-medium text-sm">Reset Demo Data</p>
                    <p className="text-xs text-gray-600 mt-1">
                      Clear all demo data and reset to initial state
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setResetDialogOpen(true)}
                    disabled={!canEdit}
                    className="border-red-300 text-red-600 hover:bg-red-100 rounded-sm"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reset
                  </Button>
                </div>
                <div className="flex items-center justify-between p-4 border border-red-200 rounded-sm bg-red-50">
                  <div>
                    <p className="font-medium text-sm">Delete Tenant</p>
                    <p className="text-xs text-gray-600 mt-1">
                      Permanently delete this tenant and all associated data
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setDeleteDialogOpen(true)}
                    disabled={!canEdit}
                    className="border-red-300 text-red-600 hover:bg-red-100 rounded-sm"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="rounded-sm border p-6">
              <div className="text-center py-8">
                <Lock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Advanced actions require SYSTEM_ADMIN access</p>
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Sticky Save Bar */}
      {dirty && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
          <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-600" />
              <span className="text-sm font-medium text-gray-700">Unsaved changes</span>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={handleDiscard}
                disabled={saving}
                className="rounded-sm"
              >
                <X className="w-4 h-4 mr-2" />
                Discard
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="rounded-sm"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Tenant Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tenant</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the tenant "{settings.name}" and all associated data.
              <br /><br />
              Type <strong>{settings.name}</strong> to confirm:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={settings.name}
              className="rounded-sm"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-sm">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                // TODO: Implement delete tenant
                showToast("info", "Not implemented", "Delete tenant functionality coming soon");
                setDeleteDialogOpen(false);
              }}
              disabled={deleteConfirmText !== settings.name}
              className="rounded-sm bg-red-600 hover:bg-red-700"
            >
              Delete Tenant
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Demo Data Dialog */}
      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Demo Data</AlertDialogTitle>
            <AlertDialogDescription>
              This will clear all demo data and reset the tenant to its initial state. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-sm">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                // TODO: Implement reset demo data
                showToast("info", "Not implemented", "Reset demo data functionality coming soon");
                setResetDialogOpen(false);
              }}
              className="rounded-sm bg-orange-600 hover:bg-orange-700"
            >
              Reset Data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

