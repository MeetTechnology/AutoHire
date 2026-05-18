import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

type MessageProps = ComponentProps<"article"> & {
  from: "user" | "assistant";
};

export function Message({ from, className, children, ...props }: MessageProps) {
  const isUser = from === "user";

  return (
    <article
      className={cn(
        "flex w-full flex-col gap-2",
        isUser ? "items-end" : "items-start",
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          "max-w-[92%] rounded-lg px-3 py-2 text-sm leading-6 shadow-sm",
          isUser
            ? "bg-primary text-primary-foreground"
            : "border-border bg-background text-foreground border",
        )}
      >
        {children}
      </div>
    </article>
  );
}

export function MessageContent({ children }: { children: ReactNode }) {
  return <div className="min-w-0">{children}</div>;
}
