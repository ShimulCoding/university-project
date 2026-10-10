import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "focus-ring inline-flex min-w-0 items-center justify-center gap-2 rounded-xl text-center text-sm font-semibold leading-snug transition-[background-color,border-color,color,box-shadow,transform] duration-200 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-4",
  {
    variants: {
      variant: {
        default:
          "border border-primary bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
        secondary:
          "bg-secondary text-secondary-foreground shadow-inset hover:bg-secondary/80",
        outline:
          "border border-border bg-panel text-foreground shadow-sm hover:border-primary/25 hover:bg-background",
        ghost: "text-muted-foreground hover:bg-secondary hover:text-foreground",
        subtle:
          "bg-panel-muted text-foreground shadow-inset hover:bg-panel-muted/80",
        danger:
          "bg-destructive text-destructive-foreground hover:bg-destructive/92 hover:-translate-y-0.5",
      },
      size: {
        default: "min-h-11 px-5 py-2.5",
        sm: "min-h-11 rounded-xl px-3.5 py-2 text-sm",
        lg: "min-h-12 px-6 py-3 text-[0.95rem]",
        icon: "h-11 w-11 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";

export { Button, buttonVariants };
