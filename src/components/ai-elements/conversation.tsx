"use client";

import { type ComponentProps, useEffect, useRef } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
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
    <ScrollArea className={cn("min-h-0 flex-1", className)} {...props}>
      <div className="flex min-h-full flex-col gap-4 px-4 py-3">
        {children}
        <div ref={endRef} aria-hidden />
      </div>
    </ScrollArea>
  );
}
