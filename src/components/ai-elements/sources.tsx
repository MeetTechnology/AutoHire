"use client";

import { ChevronDownIcon, FileTextIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SourceItem = {
  id: string;
  title: string;
  previewToken: string;
};

export function Sources({
  sources,
  className,
  onPreviewSource,
}: {
  sources: SourceItem[];
  className?: string;
  onPreviewSource: (token: string, title?: string) => void;
}) {
  const [open, setOpen] = useState(false);

  if (sources.length === 0) {
    return null;
  }

  return (
    <div className={cn("mt-2 w-full max-w-[92%]", className)}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-muted-foreground h-7 rounded-full px-2 text-xs hover:text-emerald-800"
        onClick={() => setOpen((value) => !value)}
      >
        <ChevronDownIcon
          data-icon="inline-start"
          className={cn("transition-transform", open && "rotate-180")}
        />
        {sources.length} source{sources.length > 1 ? "s" : ""}
      </Button>
      {open && (
        <div className="border-border bg-card/95 mt-1 flex flex-col gap-1.5 rounded-lg border p-2 text-xs shadow-[0_10px_26px_rgba(15,23,42,0.06)]">
          {sources.map((source) => (
            <button
              key={source.id}
              type="button"
              onClick={() => onPreviewSource(source.previewToken, source.title)}
              className="text-muted-foreground flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-emerald-50 hover:text-emerald-900"
            >
              <span className="truncate">{source.title}</span>
              <FileTextIcon aria-hidden />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
