"use client";

import { type ComponentProps, useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

export function Conversation({
  className,
  children,
  ...props
}: ComponentProps<"div">) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [children]);

  return (
    <div
      className={cn("h-0 min-h-0 flex-1 overflow-y-auto overscroll-contain", className)}
      {...props}
    >
      <div className="flex min-h-full min-w-0 flex-col gap-4 px-4 py-4">
        {children}
        <div ref={endRef} aria-hidden />
      </div>
    </div>
  );
}
