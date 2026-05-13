"use client";

import { CheckCircle2, FileText } from "lucide-react";

import type { SupplementRequestSummary } from "@/features/material-supplement/types";
import { cn } from "@/lib/utils";

type SupplementRequestCardProps = {
  request: SupplementRequestSummary;
};

function normalizeSuggestedMaterials(
  suggestedMaterials: SupplementRequestSummary["suggestedMaterials"],
) {
  if (!suggestedMaterials) {
    return [];
  }

  if (Array.isArray(suggestedMaterials)) {
    return suggestedMaterials.filter((item) => item.trim().length > 0);
  }

  return suggestedMaterials
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getRequestStatusLabel(request: SupplementRequestSummary) {
  if (request.isSatisfied || request.status === "SATISFIED") {
    return "Satisfied";
  }

  if (request.status === "UPLOADED_WAITING_REVIEW") {
    return "Waiting for review";
  }

  if (request.status === "REVIEWING") {
    return "Reviewing";
  }

  if (request.status === "HISTORY_ONLY") {
    return "History";
  }

  return "Pending";
}

export function SupplementRequestCard({ request }: SupplementRequestCardProps) {
  const suggestedMaterials = normalizeSuggestedMaterials(
    request.suggestedMaterials,
  );
  const statusLabel = getRequestStatusLabel(request);
  const isSatisfied = request.isSatisfied || request.status === "SATISFIED";

  return (
    <article className="rounded-xl border border-[color:var(--border)] bg-white p-4 shadow-[0_8px_20px_rgba(10,25,47,0.04)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex items-start gap-2">
            {isSatisfied ? (
              <CheckCircle2
                className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700"
                aria-hidden
              />
            ) : (
              <FileText
                className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--primary)]"
                aria-hidden
              />
            )}
            <h3 className="text-sm font-semibold break-words text-[color:var(--primary)]">
              {request.title}
            </h3>
          </div>
        </div>
        <span
          className={cn(
            "inline-flex w-fit shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold",
            isSatisfied
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-rose-200 bg-rose-50 text-rose-900",
          )}
        >
          {statusLabel}
        </span>
      </div>

      {request.reason ? (
        <p className="mt-3 text-sm leading-6 break-words text-[color:var(--foreground-soft)]">
          {request.reason}
        </p>
      ) : null}

      {suggestedMaterials.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-semibold text-[color:var(--primary)]">
            Suggested materials
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestedMaterials.map((item) => (
              <span
                key={item}
                className="rounded-full border border-[color:var(--border)] bg-[color:var(--muted)]/45 px-2.5 py-1 text-xs font-medium break-words text-[color:var(--foreground-soft)]"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}
