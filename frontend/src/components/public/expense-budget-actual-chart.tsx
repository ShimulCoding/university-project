"use client";

import { useState } from "react";
import type { PublicFinancialSummaryBreakdownLine } from "@/types";
import { formatMoney } from "@/lib/format";

const BUDGET_COLOR = "hsl(217, 91%, 60%)";
const ACTUAL_COLOR = "hsl(160, 84%, 39%)";
const OVER_BUDGET_COLOR = "hsl(350, 89%, 60%)";

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

  // Build actual amounts per category from segment field
  for (const item of expenseItems) {
    const cat = item.segment.trim() || "Uncategorized";
    const existing = categories.get(cat);
    if (existing) {
      existing.actual += Number(item.amount);
    } else {
      categories.set(cat, { category: cat, budget: 0, actual: Number(item.amount) });
    }
  }

  // Build budget amounts per category
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
  const maxValue = Math.max(
    ...pairs.map((p) => Math.max(p.budget, p.actual)),
    1,
  );

  const hasBudgetData = pairs.some((p) => p.budget > 0);
  const hasActualData = pairs.some((p) => p.actual > 0);

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
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <span
                className="h-3 w-3 rounded-sm"
                style={{ backgroundColor: BUDGET_COLOR }}
              />
              Budget
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <span
                className="h-3 w-3 rounded-sm"
                style={{ backgroundColor: ACTUAL_COLOR }}
              />
              Actual
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <span
                className="h-3 w-3 rounded-sm"
                style={{ backgroundColor: OVER_BUDGET_COLOR }}
              />
              Over budget
            </div>
          </div>

          {/* Bars */}
          <div className="mt-5 space-y-4">
            {pairs.map((pair, index) => {
              const budgetPct = (pair.budget / maxValue) * 100;
              const actualPct = (pair.actual / maxValue) * 100;
              const isOverBudget = pair.budget > 0 && pair.actual > pair.budget;
              const isHovered = hoveredIndex === index;

              return (
                <div
                  key={pair.category}
                  className="space-y-2 transition-opacity"
                  style={{
                    opacity:
                      hoveredIndex !== null && !isHovered ? 0.5 : 1,
                  }}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-foreground">
                      {pair.category}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {pair.budget > 0 && (
                        <span>
                          B: {formatMoney(pair.budget)}
                          <span className="mx-1 text-border">|</span>
                        </span>
                      )}
                      A: {formatMoney(pair.actual)}
                      {isOverBudget && (
                        <span className="ml-1.5 text-xs font-semibold" style={{ color: OVER_BUDGET_COLOR }}>
                          +{formatMoney(pair.actual - pair.budget)}
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Budget bar */}
                  {pair.budget > 0 && (
                    <div className="h-3.5 overflow-hidden rounded-full bg-panel shadow-inset">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.max(budgetPct, 1)}%`,
                          backgroundColor: BUDGET_COLOR,
                          opacity: 0.45,
                        }}
                      />
                    </div>
                  )}

                  {/* Actual bar */}
                  <div className="h-3.5 overflow-hidden rounded-full bg-panel shadow-inset">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.max(actualPct, 1)}%`,
                        backgroundColor: isOverBudget
                          ? OVER_BUDGET_COLOR
                          : ACTUAL_COLOR,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Totals */}
          <div className="mt-5 flex flex-wrap gap-4 border-t border-border/50 pt-4">
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
