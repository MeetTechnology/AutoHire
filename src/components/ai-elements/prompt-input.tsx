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
      className="border-border bg-background border-t p-3"
      onSubmit={handleSubmit}
    >
      <div className="border-input bg-background flex flex-col gap-2 rounded-lg border p-2 shadow-sm">
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
          className="max-h-40 min-h-20 resize-none border-0 px-1 py-1 shadow-none focus-visible:ring-0"
          aria-label="Ask AI question"
        />
        <div className="flex items-center justify-between gap-2">
          <p className="text-muted-foreground text-xs">
            Enter 发送，Shift+Enter 换行
          </p>
          <div className="flex items-center gap-2">{children}</div>
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
      className={cn("min-w-20", className)}
      size="sm"
    >
      {children}
    </Button>
  );
}
