import type { PublicFinancialSummaryBreakdownLine } from "@/types";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

const chartColors = [
  "bg-primary",
  "bg-success",
  "bg-info",
  "bg-warning",
  "bg-muted-foreground",
  "bg-destructive",
];

export function SummaryBreakdownChart({
  title,
  description,
  total,
  items,
}: {
  title: string;
  description: string;
  total: string;
  items: PublicFinancialSummaryBreakdownLine[];
}) {
  const numericTotal = Number(total);

  return (
    <div className="rounded-[1.4rem] border border-border/70 bg-panel-muted p-5">
      <div>
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>

      {items.length === 0 || numericTotal <= 0 ? (
        <div className="mt-5 rounded-[1rem] border border-border/70 bg-panel px-4 py-4 text-sm text-muted-foreground">
          No public-safe breakdown lines are available for this side of the report yet.
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {items.map((item, index) => {
            const percentage = Math.max(
              0,
              Math.min(100, (Number(item.amount) / numericTotal) * 100),
            );

            return (
              <div key={item.key} className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div className="flex items-center gap-2 font-semibold text-foreground">
                    <span
                      className={cn(
                        "h-2.5 w-2.5 rounded-full",
                        chartColors[index % chartColors.length],
                      )}
                    />
                    {item.label}
                  </div>
                  <div className="tabular-nums text-muted-foreground">
                    {formatMoney(item.amount)} | {percentage.toFixed(1)}%
                  </div>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-panel shadow-inset">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      chartColors[index % chartColors.length],
                    )}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                  {item.segment}
                  {item.recordCount > 0 ? ` | ${item.recordCount} record(s)` : ""}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
