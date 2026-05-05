"use client";

import { useState } from "react";
import type { PublicFinancialSummaryBreakdownLine } from "@/types";
import { formatMoney } from "@/lib/format";

const BUDGET_COLOR = "hsl(220, 15%, 55%)";
const ACTUAL_COLOR = "hsl(168, 65%, 47%)";

type CategoryPair = {
  category: string;
  budget: number;
  actual: number;
};

function buildCategoryPairs(
  expenseItems: PublicFinancialSummaryBreakdownLine[],
  budgetItems: PublicFinancialSummaryBreakdownLine[],
): CategoryPair[] {
  const categories = new Map<string, CategoryPair>();

  for (const item of expenseItems) {
    const cat = item.segment.trim() || "Uncategorized";
    const existing = categories.get(cat);
    if (existing) {
      existing.actual += Number(item.amount);
    } else {
      categories.set(cat, { category: cat, budget: 0, actual: Number(item.amount) });
    }
  }

  for (const item of budgetItems) {
    const cat = item.label.trim() || "Uncategorized";
    const existing = categories.get(cat);
    if (existing) {
      existing.budget += Number(item.amount);
    } else {
      categories.set(cat, { category: cat, budget: Number(item.amount), actual: 0 });
    }
  }

  return Array.from(categories.values()).sort((a, b) => {
    const maxA = Math.max(a.budget, a.actual);
    const maxB = Math.max(b.budget, b.actual);
    return maxB - maxA;
  });
}

function niceMax(value: number): number {
  if (value <= 0) return 100;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;
  if (normalized <= 1) return magnitude;
  if (normalized <= 2) return 2 * magnitude;
  if (normalized <= 5) return 5 * magnitude;
  return 10 * magnitude;
}

function buildYTicks(maxVal: number, tickCount: number): number[] {
  const step = maxVal / tickCount;
  const ticks: number[] = [];
  for (let i = 0; i <= tickCount; i++) {
    ticks.push(Math.round(step * i));
  }
  return ticks;
}

function formatAxisValue(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`;
  return value.toString();
}

export function ExpenseBudgetActualChart({
  title,
  description,
  expenseItems,
  budgetItems,
}: {
  title: string;
  description: string;
  expenseItems: PublicFinancialSummaryBreakdownLine[];
  budgetItems: PublicFinancialSummaryBreakdownLine[];
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const pairs = buildCategoryPairs(expenseItems, budgetItems);

  const hasBudgetData = pairs.some((p) => p.budget > 0);
  const hasActualData = pairs.some((p) => p.actual > 0);

  const rawMax = Math.max(...pairs.map((p) => Math.max(p.budget, p.actual)), 1);
  const yMax = niceMax(rawMax);
  const yTicks = buildYTicks(yMax, 4);

  /* ---- Layout constants ---- */
  const CHART_LEFT = 60;
  const CHART_RIGHT = 16;
  const CHART_TOP = 8;
  const CHART_BOTTOM = 44;
  const SVG_WIDTH = 520;
  const SVG_HEIGHT = 280;
  const plotW = SVG_WIDTH - CHART_LEFT - CHART_RIGHT;
  const plotH = SVG_HEIGHT - CHART_TOP - CHART_BOTTOM;

  const colCount = pairs.length || 1;
  const groupWidth = plotW / colCount;
  const barPadding = Math.max(groupWidth * 0.2, 6);
  const barAreaWidth = groupWidth - barPadding;
  const singleBarWidth = barAreaWidth / 2;

  return (
    <div className="rounded-[1.4rem] border border-border/70 bg-panel-muted p-5">
      <div>
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>

      {pairs.length === 0 || (!hasBudgetData && !hasActualData) ? (
        <div className="mt-5 rounded-[1rem] border border-border/70 bg-panel px-4 py-4 text-sm text-muted-foreground">
          No expense or budget data is available for this report yet.
        </div>
      ) : (
        <>
          {/* Legend */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-5">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <span
                className="inline-block h-3.5 w-5 rounded-sm"
                style={{ backgroundColor: BUDGET_COLOR }}
              />
              Budget
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <span
                className="inline-block h-3.5 w-5 rounded-sm"
                style={{ backgroundColor: ACTUAL_COLOR }}
              />
              Actual
            </div>
          </div>

          {/* SVG chart */}
          <div className="mt-4 w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
              className="mx-auto w-full max-w-[520px]"
              role="img"
              aria-label="Expense budget vs actual stacked column chart"
            >
              {/* Y-axis grid lines and labels */}
              {yTicks.map((tick) => {
                const y = CHART_TOP + plotH - (tick / yMax) * plotH;
                return (
                  <g key={`y-${tick}`}>
                    <line
                      x1={CHART_LEFT}
                      y1={y}
                      x2={SVG_WIDTH - CHART_RIGHT}
                      y2={y}
                      stroke="hsl(var(--border))"
                      strokeWidth="0.8"
                      strokeDasharray={tick === 0 ? "0" : "4 3"}
                      opacity={tick === 0 ? 0.7 : 0.4}
                    />
                    <text
                      x={CHART_LEFT - 8}
                      y={y + 4}
                      textAnchor="end"
                      className="fill-muted-foreground"
                      style={{ fontSize: "10px" }}
                    >
                      {formatAxisValue(tick)}
                    </text>
                  </g>
                );
              })}

              {/* Y-axis label */}
              <text
                x="14"
                y={CHART_TOP + plotH / 2}
                textAnchor="middle"
                className="fill-muted-foreground"
                style={{ fontSize: "10px", fontWeight: 600 }}
                transform={`rotate(-90 14 ${CHART_TOP + plotH / 2})`}
              >
                Amount (৳)
              </text>

              {/* Bars per category */}
              {pairs.map((pair, index) => {
                const groupX = CHART_LEFT + index * groupWidth + barPadding / 2;
                const budgetH = (pair.budget / yMax) * plotH;
                const actualH = (pair.actual / yMax) * plotH;
                const budgetY = CHART_TOP + plotH - budgetH;
                const actualY = CHART_TOP + plotH - actualH;
                const isHovered = hoveredIndex === index;
                const dimmed = hoveredIndex !== null && !isHovered;

                return (
                  <g
                    key={pair.category}
                    opacity={dimmed ? 0.35 : 1}
                    className="transition-opacity duration-200"
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    style={{ cursor: "pointer" }}
                  >
                    {/* Budget bar */}
                    {pair.budget > 0 && (
                      <rect
                        x={groupX}
                        y={budgetY}
                        width={singleBarWidth}
                        height={Math.max(budgetH, 1)}
                        rx="3"
                        fill={BUDGET_COLOR}
                      />
                    )}

                    {/* Actual bar */}
                    {pair.actual > 0 && (
                      <rect
                        x={groupX + singleBarWidth}
                        y={actualY}
                        width={singleBarWidth}
                        height={Math.max(actualH, 1)}
                        rx="3"
                        fill={ACTUAL_COLOR}
                      />
                    )}

                    {/* Value labels on hover */}
                    {isHovered && pair.budget > 0 && (
                      <text
                        x={groupX + singleBarWidth / 2}
                        y={budgetY - 5}
                        textAnchor="middle"
                        className="fill-foreground"
                        style={{ fontSize: "9px", fontWeight: 700 }}
                      >
                        {formatAxisValue(pair.budget)}
                      </text>
                    )}
                    {isHovered && pair.actual > 0 && (
                      <text
                        x={groupX + singleBarWidth + singleBarWidth / 2}
                        y={actualY - 5}
                        textAnchor="middle"
                        className="fill-foreground"
                        style={{ fontSize: "9px", fontWeight: 700 }}
                      >
                        {formatAxisValue(pair.actual)}
                      </text>
                    )}

                    {/* X-axis category label */}
                    <text
                      x={groupX + barAreaWidth / 2}
                      y={CHART_TOP + plotH + 16}
                      textAnchor="middle"
                      className="fill-muted-foreground"
                      style={{ fontSize: "10px" }}
                    >
                      {pair.category.length > 12
                        ? pair.category.slice(0, 11) + "…"
                        : pair.category}
                    </text>
                  </g>
                );
              })}

              {/* X-axis baseline */}
              <line
                x1={CHART_LEFT}
                y1={CHART_TOP + plotH}
                x2={SVG_WIDTH - CHART_RIGHT}
                y2={CHART_TOP + plotH}
                stroke="hsl(var(--border))"
                strokeWidth="1"
                opacity="0.6"
              />

              {/* X-axis label */}
              <text
                x={CHART_LEFT + plotW / 2}
                y={SVG_HEIGHT - 4}
                textAnchor="middle"
                className="fill-muted-foreground"
                style={{ fontSize: "10px", fontWeight: 600 }}
              >
                Category
              </text>
            </svg>
          </div>

          {/* Detail table below chart */}
          <div className="mt-5 space-y-2.5">
            {pairs.map((pair, index) => {
              const diff = pair.actual - pair.budget;
              const isOverBudget = pair.budget > 0 && diff > 0;
              const isUnderBudget = pair.budget > 0 && diff < 0;
              return (
                <div
                  key={pair.category}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-panel"
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  <span className="font-semibold text-foreground">{pair.category}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {pair.budget > 0 && (
                      <>
                        <span style={{ color: BUDGET_COLOR }}>B: {formatMoney(pair.budget)}</span>
                        <span className="mx-1.5 text-border">|</span>
                      </>
                    )}
                    <span style={{ color: ACTUAL_COLOR }}>A: {formatMoney(pair.actual)}</span>
                    {isOverBudget && (
                      <span className="ml-1.5 text-xs font-semibold text-destructive">
                        +{formatMoney(diff)}
                      </span>
                    )}
                    {isUnderBudget && (
                      <span className="ml-1.5 text-xs font-semibold text-success">
                        {formatMoney(diff)}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Totals */}
          <div className="mt-4 flex flex-wrap gap-4 border-t border-border/50 pt-4">
            {hasBudgetData && (
              <div className="text-sm">
                <span className="text-muted-foreground">Total budget: </span>
                <span className="font-semibold tabular-nums text-foreground">
                  {formatMoney(pairs.reduce((s, p) => s + p.budget, 0))}
                </span>
              </div>
            )}
            {hasActualData && (
              <div className="text-sm">
                <span className="text-muted-foreground">Total actual: </span>
                <span className="font-semibold tabular-nums text-foreground">
                  {formatMoney(pairs.reduce((s, p) => s + p.actual, 0))}
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
