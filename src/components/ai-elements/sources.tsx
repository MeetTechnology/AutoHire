"use client";

import { ChevronDownIcon, ExternalLinkIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SourceItem = {
  id: string;
  title: string;
  url: string;
};

export function Sources({
  sources,
  className,
}: {
  sources: SourceItem[];
  className?: string;
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
        className="text-muted-foreground h-7 px-2 text-xs"
        onClick={() => setOpen((value) => !value)}
      >
        <ChevronDownIcon
          data-icon="inline-start"
          className={cn("transition-transform", open && "rotate-180")}
        />
        {sources.length} source{sources.length > 1 ? "s" : ""}
      </Button>
      {open && (
        <div className="border-border bg-background mt-1 flex flex-col gap-1.5 rounded-lg border p-2 text-xs shadow-sm">
          {sources.map((source) => (
            <a
              key={source.id}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:bg-muted hover:text-foreground flex items-center justify-between gap-2 rounded-md px-2 py-1.5"
            >
              <span className="truncate">{source.title}</span>
              <ExternalLinkIcon aria-hidden />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
