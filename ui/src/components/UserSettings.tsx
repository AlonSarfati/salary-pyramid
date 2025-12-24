import { useState, useEffect } from "react";
import { Card } from "./ui/card";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { Switch } from "./ui/switch";
import { getAuthData } from "../services/authService";
import { StateScreen } from "./ui/StateScreen";
import { Settings, Bell, Moon, Sun, Globe, Save, Loader2 } from "lucide-react";
import { useToast } from "./ToastProvider";

export default function UserSettings() {
  const authData = getAuthData();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  
  // Settings state (stored in localStorage for now)
  const [notifications, setNotifications] = useState(() => {
    const saved = localStorage.getItem("user_settings_notifications");
    return saved ? JSON.parse(saved) : true;
  });
  
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("user_settings_theme");
    return saved || "light";
  });
  
  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem("user_settings_language");
    return saved || "en";
  });

  const handleSave = async () => {
    setLoading(true);
    try {
      // Save settings to localStorage (in a real app, this would go to the backend)
      localStorage.setItem("user_settings_notifications", JSON.stringify(notifications));
      localStorage.setItem("user_settings_theme", theme);
      localStorage.setItem("user_settings_language", language);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      showToast("success", "Settings Saved", "Your preferences have been saved successfully.");
    } catch (error: any) {
      showToast("error", "Error", error.message || "Failed to save settings");
    } finally {
      setLoading(false);
    }
  };

  if (!authData) {
    return (
      <StateScreen
        icon={Settings}
        title="No User Data"
        description="Please sign in to access settings"
      />
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#1E1E1E] mb-2">Settings</h1>
        <p className="text-gray-600">Manage your account preferences and application settings</p>
      </div>

      <div className="space-y-4">
        {/* Notifications */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-[#1E1E1E] mb-4 flex items-center gap-2">
            <Bell className="w-5 h-5 text-[#0052CC]" />
            Notifications
          </h2>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Label className="text-sm font-medium text-[#1E1E1E]">Email Notifications</Label>
              <p className="text-sm text-gray-600 mt-1">
                Receive email notifications about important updates and changes
              </p>
            </div>
            <Switch
              checked={notifications}
              onCheckedChange={setNotifications}
            />
          </div>
        </Card>

        {/* Appearance */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-[#1E1E1E] mb-4 flex items-center gap-2">
            {theme === "dark" ? (
              <Moon className="w-5 h-5 text-[#0052CC]" />
            ) : (
              <Sun className="w-5 h-5 text-[#0052CC]" />
            )}
            Appearance
          </h2>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-[#1E1E1E]">Theme</Label>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => setTheme("light")}
                  className={`px-4 py-2 rounded-lg border transition-colors ${
                    theme === "light"
                      ? "bg-[#0052CC] text-white border-[#0052CC]"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  Light
                </button>
                <button
                  onClick={() => setTheme("dark")}
                  className={`px-4 py-2 rounded-lg border transition-colors ${
                    theme === "dark"
                      ? "bg-[#0052CC] text-white border-[#0052CC]"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  Dark
                </button>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Note: Theme changes will be applied after saving
              </p>
            </div>
          </div>
        </Card>

        {/* Language & Region */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-[#1E1E1E] mb-4 flex items-center gap-2">
            <Globe className="w-5 h-5 text-[#0052CC]" />
            Language & Region
          </h2>
          <div>
            <Label className="text-sm font-medium text-[#1E1E1E]">Language</Label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="mt-2 w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-[#1E1E1E]"
            >
              <option value="en">English</option>
              <option value="he">Hebrew</option>
              <option value="ar">Arabic</option>
            </select>
            <p className="text-sm text-gray-600 mt-2">
              Select your preferred language for the interface
            </p>
          </div>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end gap-3">
          <Button
            onClick={handleSave}
            disabled={loading}
            className="bg-[#0052CC] hover:bg-[#003D99] text-white"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

