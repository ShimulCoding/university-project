"use client";

import { useState } from "react";
import type { PublicFinancialSummaryBreakdownLine } from "@/types";
import { formatMoney } from "@/lib/format";

const PIE_COLORS = [
  "hsl(217, 91%, 60%)",   // vivid blue
  "hsl(160, 84%, 39%)",   // emerald
  "hsl(38, 92%, 50%)",    // amber
  "hsl(280, 67%, 55%)",   // purple
  "hsl(350, 89%, 60%)",   // rose
  "hsl(192, 91%, 36%)",   // cyan
  "hsl(25, 95%, 53%)",    // orange
  "hsl(142, 71%, 45%)",   // green
  "hsl(330, 70%, 50%)",   // magenta
  "hsl(200, 80%, 50%)",   // sky
  "hsl(60, 80%, 42%)",    // olive
  "hsl(10, 85%, 55%)",    // red-orange
];

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
}

export function IncomePieChart({
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
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
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
        <div className="mt-5 flex flex-col items-center gap-6 md:flex-row md:items-start">
          {/* Pie chart */}
          <div className="shrink-0">
            <svg
              viewBox="0 0 220 220"
              className="h-52 w-52 drop-shadow-sm md:h-56 md:w-56"
              role="img"
              aria-label="Income source pie chart"
            >
              {(() => {
                let currentAngle = 0;
                return items.map((item, index) => {
                  const percentage = (Number(item.amount) / numericTotal) * 360;
                  const slice = percentage < 0.5 ? 0.5 : percentage;
                  const startAngle = currentAngle;
                  const endAngle = currentAngle + slice;
                  currentAngle = endAngle;

                  const isFullCircle = items.length === 1;
                  const isHovered = hoveredIndex === index;
                  const scale = isHovered ? "scale(1.04)" : "scale(1)";

                  if (isFullCircle) {
                    return (
                      <circle
                        key={item.key}
                        cx="110"
                        cy="110"
                        r="90"
                        fill={PIE_COLORS[index % PIE_COLORS.length]}
                        opacity={hoveredIndex !== null && !isHovered ? 0.4 : 1}
                        className="transition-all duration-200"
                        style={{ transformOrigin: "110px 110px", transform: scale }}
                        onMouseEnter={() => setHoveredIndex(index)}
                        onMouseLeave={() => setHoveredIndex(null)}
                      />
                    );
                  }

                  return (
                    <path
                      key={item.key}
                      d={describeArc(110, 110, 90, startAngle, endAngle)}
                      fill={PIE_COLORS[index % PIE_COLORS.length]}
                      stroke="hsl(var(--panel-muted))"
                      strokeWidth="2"
                      opacity={hoveredIndex !== null && !isHovered ? 0.4 : 1}
                      className="cursor-pointer transition-all duration-200"
                      style={{ transformOrigin: "110px 110px", transform: scale }}
                      onMouseEnter={() => setHoveredIndex(index)}
                      onMouseLeave={() => setHoveredIndex(null)}
                    />
                  );
                });
              })()}
              <circle
                cx="110"
                cy="110"
                r="50"
                fill="hsl(var(--panel-muted))"
                className="pointer-events-none"
              />
              <text
                x="110"
                y="105"
                textAnchor="middle"
                className="fill-foreground text-[11px] font-semibold"
              >
                Total
              </text>
              <text
                x="110"
                y="122"
                textAnchor="middle"
                className="fill-primary text-[10px] font-semibold"
              >
                {formatMoney(total)}
              </text>
            </svg>
          </div>

          {/* Legend — scrollable when many items */}
          <div className="w-full min-w-0 flex-1">
            <div className="max-h-[260px] space-y-1 overflow-y-auto pr-1">
              {items.map((item, index) => {
                const pct = ((Number(item.amount) / numericTotal) * 100).toFixed(1);
                const isHovered = hoveredIndex === index;
                return (
                  <div
                    key={item.key}
                    className={
                      "flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors" +
                      (isHovered ? " bg-panel" : " hover:bg-panel/60")
                    }
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                      />
                      <span className="truncate font-semibold text-foreground">
                        {item.label}
                      </span>
                    </div>
                    <div className="shrink-0 whitespace-nowrap tabular-nums text-muted-foreground">
                      {formatMoney(item.amount)} ({pct}%)
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
