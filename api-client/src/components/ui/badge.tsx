import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-zinc-600 bg-zinc-800 text-white",
        success: "border-emerald-700 bg-emerald-950 text-emerald-300",
        warning: "border-amber-700 bg-amber-950 text-amber-300",
        error: "border-red-700 bg-red-950 text-red-300",
        info: "border-sky-700 bg-sky-950 text-sky-300",
        outline: "border-zinc-600 text-white bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
