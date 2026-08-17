import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-white text-zinc-900 hover:bg-zinc-100 border border-white shadow-sm",
        secondary:
          "bg-zinc-800 text-white hover:bg-zinc-700 border border-zinc-700",
        outline:
          "border border-zinc-600 bg-transparent text-white hover:bg-zinc-800 hover:border-zinc-500",
        ghost: "text-white hover:bg-zinc-800",
        destructive:
          "bg-red-600 text-white hover:bg-red-500 border border-red-500",
        send: "bg-white text-zinc-900 hover:bg-zinc-100 border border-white font-semibold shadow-md px-6",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-6",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
