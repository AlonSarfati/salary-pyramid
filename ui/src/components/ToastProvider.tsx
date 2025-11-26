import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { CheckCircle, AlertCircle, Info } from "lucide-react";

type ToastType = "success" | "error" | "info";

type Toast = {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
};

type ToastContextValue = {
  showToast: (type: ToastType, title: string, message?: string) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((type: ToastType, title: string, message?: string) => {
    setToasts((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        type,
        title,
        message,
      },
    ]);
  }, []);

  // Auto-remove toasts after 4 seconds
  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((toast) =>
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 4000)
    );
    return () => {
      timers.forEach(clearTimeout);
    };
  }, [toasts]);

  const renderIcon = (type: ToastType) => {
    switch (type) {
      case "success":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "error":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg bg-white border border-gray-200 min-w-[260px] max-w-sm"
          >
            <div className="mt-0.5">{renderIcon(toast.type)}</div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-[#1E1E1E]">{toast.title}</div>
              {toast.message && (
                <div className="text-xs text-gray-600 mt-0.5 whitespace-pre-line">{toast.message}</div>
              )}
            </div>
            <button
              className="text-xs text-gray-400 hover:text-gray-600"
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};


