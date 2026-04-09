import * as React from "react";

import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", "aria-invalid": ariaInvalid, ...props }, ref) => {
    const isInvalid = ariaInvalid === true || ariaInvalid === "true";

    return (
      <input
        type={type}
        className={cn(
          "focus-ring flex h-11 w-full rounded-xl bg-panel px-4 text-sm text-foreground shadow-sm transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-muted-foreground/80",
          isInvalid
            ? "border-destructive/40 bg-destructive/5 focus-visible:border-destructive/40 hover:border-destructive/40"
            : "border-input hover:border-primary/20 focus-visible:border-primary/25",
          className,
        )}
        ref={ref}
        aria-invalid={ariaInvalid}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";
