import { MarkdownProse } from "@/components/ui/markdown-prose";
import { cn } from "@/lib/utils";

export function Response({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <MarkdownProse
      markdown={children}
      className={cn(
        "text-foreground [&_p]:mb-2 [&_p]:text-sm [&_p]:leading-6",
        className,
      )}
    />
  );
}
