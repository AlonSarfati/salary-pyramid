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
    title: "Connection error",
    description: "Unable to connect to the server. Please check your internet connection and try again.",
    primaryLabel: "Retry",
    secondaryLabel: "Contact support",
  },
  system: {
    title: "System error",
    description: "An unexpected error occurred while processing your request. Please try again.",
    primaryLabel: "Retry",
    secondaryLabel: "Contact support",
  },
  permission: {
    title: "Access restricted",
    description: "You don't have permission to view this information. Contact your administrator if you believe this is a mistake.",
    primaryLabel: "Request access",
    secondaryLabel: "Back",
  },
  empty: {
    title: "No data available",
    description: "There is no data to display. Create or import data to get started.",
    primaryLabel: "Get started",
  },
  validation: {
    title: "Validation error",
    description: "Please check the form and correct any errors.",
    primaryLabel: "OK",
  },
};

const getIcon = (type: StateScreenType, className?: string) => {
  // Error states use red/warning colors, empty states use neutral colors
  const isError = type === "network" || type === "system" || type === "permission" || type === "validation";
  const iconClass = cn(
    isError ? "w-12 h-12 text-red-500" : "w-12 h-12 text-slate-400",
    className
  );
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
  // Safety check: ensure type is valid
  const validType = defaultContent[type] ? type : 'system';
  const content = defaultContent[validType];
  const displayTitle = title || content.title;
  const displayDescription = description || content.description;
  const displayPrimaryLabel = primaryActionLabel || content.primaryLabel;
  const displaySecondaryLabel = secondaryActionLabel || content.secondaryLabel;

  const [showDetails, setShowDetails] = React.useState(false);
  const isError = type === "network" || type === "system" || type === "permission" || type === "validation";
  const isEmpty = type === "empty";

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
      {/* Subtle background circle - different colors for errors vs empty */}
      <div className={cn(
        "absolute w-20 h-20 rounded-full opacity-50",
        isError ? "bg-red-50" : "bg-slate-100"
      )} />
      {getIcon(type)}
    </div>
  );

  if (inline) {
    return (
      <div className={cn(
        "flex items-start gap-3 p-4 rounded-lg",
        isError ? "bg-red-50 border border-red-200" : "bg-white border border-slate-200",
        className
      )}>
        <div className="flex-shrink-0 mt-0.5">
          {getIcon(type, isError ? "w-5 h-5 text-red-600" : "w-5 h-5 text-slate-500")}
        </div>
        <div className="flex-1 min-w-0">
          <div className={cn(
            "text-sm font-semibold",
            isError ? "text-red-900" : "text-slate-900"
          )}>{displayTitle}</div>
          {displayDescription && (
            <div className={cn(
              "mt-1 text-sm leading-relaxed",
              isError ? "text-red-700" : "text-slate-600"
            )}>{displayDescription}</div>
          )}
          {supportRef && isError && (
            <div className="mt-2 text-xs text-red-600">Reference ID: {supportRef}</div>
          )}
          {/* Error states: Show retry actions */}
          {isError && (onPrimaryAction || onSecondaryAction) && (
            <div className="mt-3 flex gap-2">
              {onPrimaryAction && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={onPrimaryAction}
                  className="!bg-red-600 !hover:bg-red-700 !text-white"
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
          {/* Empty states: Show creation actions */}
          {isEmpty && onPrimaryAction && (
            <div className="mt-3 flex gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={onPrimaryAction}
                className="!bg-[#4E9F6A] !hover:bg-[#2F6A43] !text-white"
              >
                {displayPrimaryLabel}
              </Button>
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
        
        <h3 className={cn(
          "text-lg font-semibold",
          isError ? "text-red-900" : "text-slate-900"
        )}>{displayTitle}</h3>
        <p className={cn(
          "mt-2 text-sm leading-relaxed",
          isError ? "text-red-700" : "text-slate-600"
        )}>{displayDescription}</p>

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

        {/* Error states: Show retry/contact support actions */}
        {isError && (onPrimaryAction || onSecondaryAction || type === "network" || type === "system") && (
          <div className="mt-5 flex gap-3 justify-center">
            {(onPrimaryAction || type === "network" || type === "system") && (
              <Button
                variant="default"
                onClick={onPrimaryAction || handleRetry}
                className="!bg-red-600 !hover:bg-red-700 !text-white rounded-md px-4 py-2 text-sm font-medium"
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
        
        {/* Empty states: Show creation/import actions (no retry) */}
        {isEmpty && onPrimaryAction && (
          <div className="mt-5 flex gap-3 justify-center">
            <Button
              variant="default"
              onClick={onPrimaryAction}
              className="!bg-[#4E9F6A] !hover:bg-[#2F6A43] !text-white rounded-md px-4 py-2 text-sm font-medium"
            >
              {displayPrimaryLabel}
            </Button>
            {onSecondaryAction && (
              <Button
                variant="outline"
                onClick={onSecondaryAction}
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
