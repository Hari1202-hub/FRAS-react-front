import React from "react";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

export type RequestStatus = "idle" | "loading" | "success" | "error";

interface StatusModalProps {
  status: RequestStatus;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function LoadingOverlay({
  status,
  title,
  description,
  actionLabel = "Close",
  onAction,
}: StatusModalProps) {
  // 1. Don't render anything if the status is idle
  if (status === "idle") return null;

  // 2. Configuration for each state (Icon, Color, Default Text)
  const stateConfig = {
    loading: {
      icon: <Loader2 className="h-12 w-12 animate-spin text-blue-600" />,
      title: "Processing...",
      desc: "Please wait while we complete your request.",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-100",
    },
    success: {
      icon: (
        <CheckCircle2 className="h-12 w-12 text-green-600 animate-in zoom-in duration-300" />
      ),
      title: "Success!",
      desc: "Your operation has been completed successfully.",
      bgColor: "bg-green-50",
      borderColor: "border-green-100",
    },
    error: {
      icon: (
        <XCircle className="h-12 w-12 text-red-600 animate-in zoom-in duration-300" />
      ),
      title: "Something went wrong",
      desc: "We couldn't complete your request. Please try again.",
      bgColor: "bg-red-50",
      borderColor: "border-red-100",
    },
  };

  const config = stateConfig[status];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center my-0 justify-center bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200">
      {/* Modal Card */}
      <div
        className={`
          relative w-full max-w-[350px] overflow-hidden rounded-2xl bg-white p-6 shadow-2xl 
          border ${config.borderColor}
          flex flex-col items-center text-center gap-5
          animate-in zoom-in-95 slide-in-from-bottom-2 duration-300
        `}
      >
        {/* Icon Circle */}
        <div
          className={`flex h-20 w-20 items-center justify-center rounded-full ${config.bgColor}`}
        >
          {config.icon}
        </div>

        {/* Text Content */}
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-gray-900">
            {title || config.title}
          </h3>
          <p className="text-sm text-gray-500 leading-relaxed">
            {description || config.desc}
          </p>
        </div>

        {/* Action Button (Only show for Success/Error) */}
        {status !== "loading" && (
          <button
            onClick={onAction}
            className="w-full rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-800 active:scale-95"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
