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
          "max-w-[92%] rounded-lg px-3.5 py-2.5 text-sm leading-6 shadow-sm",
          isUser
            ? "bg-[#0a192f] text-white shadow-[0_10px_24px_rgba(10,25,47,0.16)]"
            : "border-border bg-card/95 text-foreground border shadow-[0_10px_26px_rgba(15,23,42,0.06)]",
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
