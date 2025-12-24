import { useState } from "react";
import { Link } from "react-router-dom";
import { useTenant } from "../App";
import { useTenantSettings } from "../hooks/useTenantSettings";
import { canEditTenantSettings, isAdmin } from "../utils/permissions";
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
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Switch } from "./ui/switch";
import { Skeleton } from "./ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Building2, Save, X, AlertTriangle, HelpCircle, Trash2, RotateCcw } from "lucide-react";
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

export default function AdminTenantPage() {
  const { tenantId } = useTenant();
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  const canEdit = canEditTenantSettings();
  const admin = isAdmin();

  if (loading) {
    return (
      <div className="p-6 max-w-[1600px] mx-auto">
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
      <div className="p-6 max-w-[1600px] mx-auto">
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
    } catch (err) {
      // Error handled in hook
    }
  };

  const handleDeleteTenant = () => {
    // TODO: Implement delete tenant API call
    console.log("Delete tenant:", tenantId);
  };

  const handleResetDemo = () => {
    // TODO: Implement reset demo data API call
    console.log("Reset demo data for:", tenantId);
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto pb-24">
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
            <BreadcrumbPage>Tenant Configuration</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#1E1E1E] mb-1">Tenant Configuration</h1>
        <p className="text-sm text-gray-600">
          Configure settings for this tenant (timezone, currency, locale, exports, security, etc.). 
          To create or edit tenant entities, use "Manage Tenants" in the system admin menu.
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <Alert variant="destructive" className="mb-6 rounded-sm">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-6">
        {/* Tenant Profile */}
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
            </div>
          </div>
        </Card>

        {/* Currency & Locale */}
        <Card className="rounded-sm border p-6">
          <h2 className="text-lg font-semibold text-[#1E1E1E] mb-4">Currency & Locale</h2>
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
            </div>
          </div>
        </Card>

        {/* Security */}
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
                    <p>Requires Keycloak SSO setup</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Switch
                id="require-sso"
                checked={settings.requireSso}
                onCheckedChange={(checked) => updateSettings({ requireSso: checked })}
                disabled={!admin || !canEdit}
                className="rounded-sm"
              />
            </div>
            {!admin && (
              <p className="text-xs text-gray-500">Only admins can change SSO settings</p>
            )}
          </div>
        </Card>

        {/* Exports & Retention */}
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
                How long to retain data before automatic deletion
              </p>
            </div>
          </div>
        </Card>

        {/* Danger Zone */}
        {admin && (
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
                  className="border-red-300 text-red-600 hover:bg-red-100 rounded-sm"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Save Bar */}
      {dirty && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg z-50">
          <div className="max-w-[1600px] mx-auto flex items-center justify-between">
            <p className="text-sm text-gray-600">You have unsaved changes</p>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={discardChanges}
                disabled={saving}
                className="rounded-sm"
              >
                <X className="mr-2 h-4 w-4" />
                Discard
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-[#0052CC] hover:bg-[#003D99] text-white rounded-sm"
              >
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Tenant Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="rounded-sm">
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete Tenant</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the tenant and all associated data.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="delete-confirm">
              Type <strong>{settings.name}</strong> to confirm:
            </Label>
            <Input
              id="delete-confirm"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="mt-2 rounded-sm"
              placeholder={settings.name}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeleteConfirmText("");
              }}
              className="rounded-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteTenant}
              disabled={deleteConfirmText !== settings.name}
              className="bg-red-600 hover:bg-red-700 text-white rounded-sm"
            >
              Delete Tenant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Demo Data Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="rounded-sm">
          <DialogHeader>
            <DialogTitle>Reset Demo Data</DialogTitle>
            <DialogDescription>
              This will clear all demo data and reset the tenant to its initial state. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResetDialogOpen(false)}
              className="rounded-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleResetDemo}
              className="bg-orange-600 hover:bg-orange-700 text-white rounded-sm"
            >
              Reset Demo Data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
