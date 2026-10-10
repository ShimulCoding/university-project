"use client";

import { cn } from "@/lib/utils";

type SegmentOption = {
  label: string;
  value: string;
  meta?: string;
};

type SegmentedControlProps = {
  label?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: SegmentOption[];
};

export function SegmentedControl({
  label = "Options",
  value,
  onValueChange,
  options,
}: SegmentedControlProps) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1 rounded-xl border border-border/80 bg-panel-muted p-1">
      {options.map((option) => {
        const active = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onValueChange(option.value)}
            className={cn(
              "focus-ring min-h-11 flex-1 rounded-lg px-4 py-2.5 text-left text-sm transition-colors",
              active
                ? "bg-panel text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <div className="font-semibold">{option.label}</div>
            {option.meta ? (
              <div className="mt-0.5 text-xs text-muted-foreground">{option.meta}</div>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
