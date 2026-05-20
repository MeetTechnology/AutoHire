"use client";

import type { FormEvent, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function PromptInput({
  value,
  onValueChange,
  onSubmit,
  disabled,
  placeholder,
  children,
}: {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
  children?: ReactNode;
}) {
  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form
      className="border-border/80 w-full border-t bg-card p-3 shadow-[0_-18px_40px_rgba(15,23,42,0.06)]"
      onSubmit={handleSubmit}
    >
      <div className="border-input bg-background flex flex-col gap-2 rounded-lg border p-2 shadow-[0_8px_22px_rgba(15,23,42,0.05)] focus-within:border-emerald-500/45 focus-within:ring-3 focus-within:ring-emerald-500/12">
        <Textarea
          value={value}
          onChange={(event) => onValueChange(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSubmit();
            }
          }}
          disabled={disabled}
          placeholder={placeholder}
          className="max-h-40 min-h-20 resize-none border-0 px-1 py-1 text-sm leading-6 shadow-none focus-visible:ring-0"
          aria-label="Guidance question"
        />
        <div className="flex min-w-0 items-center justify-between gap-2">
          <p className="text-muted-foreground min-w-0 shrink text-xs">
            Enter 发送，Shift+Enter 换行
          </p>
          <div className="flex shrink-0 items-center gap-2">{children}</div>
        </div>
      </div>
    </form>
  );
}

export function PromptInputSubmit({
  disabled,
  children,
  className,
}: {
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Button
      type="submit"
      disabled={disabled}
      className={cn("min-w-20 bg-emerald-700 hover:bg-emerald-800", className)}
      size="sm"
    >
      {children}
    </Button>
  );
}
