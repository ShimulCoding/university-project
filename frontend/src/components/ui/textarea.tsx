import * as React from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, "aria-invalid": ariaInvalid, ...props }, ref) => {
    const isInvalid = ariaInvalid === true || ariaInvalid === "true";

    return (
      <textarea
        className={cn(
          "focus-ring min-h-[120px] w-full rounded-2xl bg-panel px-4 py-3 text-sm text-foreground shadow-sm transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-muted-foreground/80",
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

Textarea.displayName = "Textarea";
