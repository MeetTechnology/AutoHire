import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-xs font-semibold tracking-wide",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[color:var(--primary)] text-[color:var(--primary-foreground)]",
        secondary:
          "border-transparent bg-[color:var(--muted)] text-[color:var(--foreground)]",
        destructive: "border-transparent bg-rose-600 text-white",
        outline:
          "border-[color:var(--border)] bg-transparent text-[color:var(--foreground)]",
        success:
          "border-transparent bg-[color:var(--accent)] text-white shadow-sm",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export type BadgeProps = HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { badgeVariants };
