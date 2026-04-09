import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

type SelectOption = {
  label: string;
  value: string;
};

interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  options: SelectOption[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, options, "aria-invalid": ariaInvalid, ...props }, ref) => {
    const isInvalid = ariaInvalid === true || ariaInvalid === "true";

    return (
      <div className="relative">
        <select
          ref={ref}
          className={cn(
            "focus-ring h-11 w-full appearance-none rounded-xl bg-panel px-4 pr-10 text-sm text-foreground shadow-sm transition-[border-color,box-shadow,background-color] duration-200",
            isInvalid
              ? "border-destructive/40 bg-destructive/5 focus-visible:border-destructive/40 hover:border-destructive/40"
              : "border-input hover:border-primary/20 focus-visible:border-primary/25",
            className,
          )}
          aria-invalid={ariaInvalid}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </div>
    );
  },
);

Select.displayName = "Select";
