"use client";

import { ArrowLeft, RefreshCw } from "lucide-react";

import { StatusBanner, getButtonClassName } from "@/components/ui/page-shell";
import type { SupplementAccessErrorState } from "@/features/material-supplement/access-error";
import { cn } from "@/lib/utils";

type SupplementAccessErrorProps = {
  error: SupplementAccessErrorState;
  isRefreshing?: boolean;
  onRefresh?: () => Promise<void> | void;
  continueHref?: string;
};

export function SupplementAccessError({
  error,
  isRefreshing = false,
  onRefresh,
  continueHref = "/apply",
}: SupplementAccessErrorProps) {
  const showContinue = error.kind === "notSubmitted";

  return (
    <StatusBanner
      tone="danger"
      title={error.title}
      description={error.description}
    >
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        {onRefresh ? (
          <button
            type="button"
            className={cn(getButtonClassName("secondary"), "w-full sm:w-auto")}
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={cn("h-4 w-4", isRefreshing && "animate-spin")}
              aria-hidden
            />
            Refresh
          </button>
        ) : null}
        <a
          href={showContinue ? continueHref : "/apply"}
          className={cn(getButtonClassName("secondary"), "w-full sm:w-auto")}
        >
          {showContinue ? null : <ArrowLeft className="h-4 w-4" aria-hidden />}
          {showContinue ? "Continue application" : "Back to application entry"}
        </a>
      </div>
    </StatusBanner>
  );
}
