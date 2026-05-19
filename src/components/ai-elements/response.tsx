import { MarkdownProse } from "@/components/ui/markdown-prose";
import { cn } from "@/lib/utils";

export function Response({
  children,
  className,
  onPreviewSource,
}: {
  children: string;
  className?: string;
  onPreviewSource?: (token: string, title?: string) => void;
}) {
  return (
    <MarkdownProse
      markdown={children}
      onPreviewSource={onPreviewSource}
      className={cn(
        "text-foreground [&_p]:mb-2 [&_p]:text-sm [&_p]:leading-6",
        className,
      )}
    />
  );
}
