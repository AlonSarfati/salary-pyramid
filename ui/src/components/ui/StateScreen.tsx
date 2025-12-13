import * as React from "react";
import { WifiOff, ServerCrash, Lock, FolderOpen, AlertCircle, AlertTriangle } from "lucide-react";
import { Button } from "./button";
import { cn } from "./utils";

type StateScreenType = "network" | "system" | "permission" | "empty" | "validation";

interface StateScreenProps {
  type: StateScreenType;
  title?: string;
  description?: string;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  details?: string;
  supportRef?: string;
  illustration?: React.ReactNode;
  className?: string;
  inline?: boolean;
}

const defaultContent: Record<StateScreenType, { title: string; description: string; primaryLabel: string; secondaryLabel?: string }> = {
  network: {
    title: "We can't connect right now",
    description: "There was a temporary issue loading your data. Check your connection and try again.",
    primaryLabel: "Retry",
    secondaryLabel: "Contact support",
  },
  system: {
    title: "Something went wrong",
    description: "We couldn't complete your request. Please try again in a moment.",
    primaryLabel: "Try again",
    secondaryLabel: "Contact support",
  },
  permission: {
    title: "Access restricted",
    description: "You don't have permission to view this information. Contact your administrator if you believe this is a mistake.",
    primaryLabel: "Request access",
    secondaryLabel: "Back",
  },
  empty: {
    title: "Nothing here yet",
    description: "Create your first simulation to start analyzing salary impact.",
    primaryLabel: "Create simulation",
  },
  validation: {
    title: "Validation error",
    description: "Please check the form and correct any errors.",
    primaryLabel: "OK",
  },
};

const getIcon = (type: StateScreenType, className?: string) => {
  const iconClass = cn("w-12 h-12 text-slate-400", className);
  switch (type) {
    case "network":
      return <WifiOff className={iconClass} />;
    case "system":
      return <ServerCrash className={iconClass} />;
    case "permission":
      return <Lock className={iconClass} />;
    case "empty":
      return <FolderOpen className={iconClass} />;
    case "validation":
      return <AlertCircle className={iconClass} />;
    default:
      return <AlertTriangle className={iconClass} />;
  }
};

export function StateScreen({
  type,
  title,
  description,
  primaryActionLabel,
  onPrimaryAction,
  secondaryActionLabel,
  onSecondaryAction,
  details,
  supportRef,
  illustration,
  className,
  inline = false,
}: StateScreenProps) {
  const content = defaultContent[type];
  const displayTitle = title || content.title;
  const displayDescription = description || content.description;
  const displayPrimaryLabel = primaryActionLabel || content.primaryLabel;
  const displaySecondaryLabel = secondaryActionLabel || content.secondaryLabel;

  const [showDetails, setShowDetails] = React.useState(false);
  const isError = type === "network" || type === "system" || type === "permission" || type === "validation";

  const handleRetry = () => {
    if (onPrimaryAction) {
      onPrimaryAction();
    } else {
      window.location.reload();
    }
  };

  const handleBack = () => {
    if (onSecondaryAction) {
      onSecondaryAction();
    } else {
      window.history.back();
    }
  };

  const icon = illustration || (
    <div className="relative flex items-center justify-center mb-4">
      {/* Subtle background circle */}
      <div className="absolute w-20 h-20 rounded-full bg-slate-100 opacity-50" />
      {getIcon(type)}
    </div>
  );

  if (inline) {
    return (
      <div className={cn("flex items-start gap-3 p-4 bg-white border border-slate-200 rounded-lg", className)}>
        <div className="flex-shrink-0 mt-0.5">{getIcon(type, "w-5 h-5 text-slate-500")}</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-slate-900">{displayTitle}</div>
          {displayDescription && (
            <div className="mt-1 text-sm text-slate-600 leading-relaxed">{displayDescription}</div>
          )}
          {supportRef && (
            <div className="mt-2 text-xs text-slate-500">Reference ID: {supportRef}</div>
          )}
          {(onPrimaryAction || onSecondaryAction) && (
            <div className="mt-3 flex gap-2">
              {onPrimaryAction && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={onPrimaryAction}
                  className="!bg-[#4E9F6A] !hover:bg-[#2F6A43] !text-white"
                >
                  {displayPrimaryLabel}
                </Button>
              )}
              {onSecondaryAction && (
                <Button variant="outline" size="sm" onClick={onSecondaryAction}>
                  {displaySecondaryLabel}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("min-h-[60vh] flex items-center justify-center p-6", className)}>
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-lg shadow-sm p-6 text-center">
        {icon}
        
        <h3 className="text-lg font-semibold text-slate-900">{displayTitle}</h3>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">{displayDescription}</p>

        {supportRef && (
          <div className="mt-4 text-xs text-slate-500 font-mono">Reference ID: {supportRef}</div>
        )}

        {details && (
          <div className="mt-4">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs text-slate-500 hover:text-slate-700 underline"
            >
              {showDetails ? "Hide" : "Show"} details
            </button>
            {showDetails && (
              <div className="mt-2 p-3 bg-slate-50 rounded text-xs text-slate-600 font-mono text-left whitespace-pre-wrap break-words">
                {details}
              </div>
            )}
          </div>
        )}

        {(onPrimaryAction || onSecondaryAction || type === "network" || type === "system") && (
          <div className="mt-5 flex gap-3 justify-center">
            {(onPrimaryAction || type === "network" || type === "system") && (
              <Button
                variant="default"
                onClick={onPrimaryAction || handleRetry}
                className="!bg-[#4E9F6A] !hover:bg-[#2F6A43] !text-white rounded-md px-4 py-2 text-sm font-medium"
              >
                {displayPrimaryLabel}
              </Button>
            )}
            {onSecondaryAction && (
              <Button
                variant="outline"
                onClick={onSecondaryAction}
                className="border border-slate-200 hover:bg-slate-50 text-slate-800 rounded-md px-4 py-2 text-sm font-medium"
              >
                {displaySecondaryLabel}
              </Button>
            )}
            {!onSecondaryAction && (type === "network" || type === "system") && displaySecondaryLabel && (
              <Button
                variant="outline"
                onClick={handleBack}
                className="border border-slate-200 hover:bg-slate-50 text-slate-800 rounded-md px-4 py-2 text-sm font-medium"
              >
                {displaySecondaryLabel}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

