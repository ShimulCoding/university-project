"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", "aria-invalid": ariaInvalid, ...props }, ref) => {
    const isInvalid = ariaInvalid === true || ariaInvalid === "true";

    return (
      <input
        type={type}
        className={cn(
          "focus-ring flex h-12 w-full min-w-0 rounded-xl border bg-panel px-3.5 text-sm text-foreground transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-semibold",
          isInvalid
            ? "border-destructive/40 bg-destructive/5 focus-visible:border-destructive/40 hover:border-destructive/40"
            : "border-input hover:border-primary/20 focus-visible:border-primary/25",
          className,
        )}
        ref={ref}
        aria-invalid={ariaInvalid}
        onWheel={(e) => {
          if (type === "number") {
            (e.target as HTMLInputElement).blur();
          }
          if (props.onWheel) {
            props.onWheel(e);
          }
        }}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";
