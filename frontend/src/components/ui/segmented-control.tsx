"use client";

import { cn } from "@/lib/utils";

type SegmentOption = {
  label: string;
  value: string;
  meta?: string;
};

type SegmentedControlProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: SegmentOption[];
};

export function SegmentedControl({
  value,
  onValueChange,
  options,
}: SegmentedControlProps) {
  return (
    <div className="inline-flex flex-wrap gap-2 rounded-2xl border border-border/80 bg-panel-muted p-1 shadow-inset">
      {options.map((option) => {
        const active = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onValueChange(option.value)}
            className={cn(
              "rounded-[1rem] px-4 py-2 text-left text-sm transition-colors",
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
