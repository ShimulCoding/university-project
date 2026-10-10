import { sumExactMoney } from "@/lib/format";
import type { PublicFinancialSummaryBreakdownLine } from "@/types";

export const financialChartPalette = {
  income: [
    "#286653",
    "#274e62",
    "#997642",
    "#72628a",
    "#a45158",
    "#3c7b83",
    "#aa6e42",
    "#587446",
    "#8e6080",
    "#507594",
    "#818143",
    "#a15f4c",
  ],
  budget: "#64717d",
  actual: "#286653",
};

/** Exact values feed labels; numeric values are used only for chart geometry. */
export function buildCategoryPairs(
  expenseItems: PublicFinancialSummaryBreakdownLine[],
  budgetItems: PublicFinancialSummaryBreakdownLine[],
) {
  const categories = new Map<string, { budget: string[]; actual: string[] }>();
  function add(category: string, side: "budget" | "actual", amount: string) {
    const key = category.trim() || "Uncategorized";
    let values = categories.get(key);
    if (!values) {
      values = { budget: [], actual: [] };
      categories.set(key, values);
    }
    values[side].push(amount);
  }
  for (const item of expenseItems) add(item.segment, "actual", item.amount);
  for (const item of budgetItems) add(item.label, "budget", item.amount);
  return Array.from(categories, ([category, values]) => {
    const budgetExact = sumExactMoney(values.budget);
    const actualExact = sumExactMoney(values.actual);
    const difference = sumExactMoney([
      actualExact,
      budgetExact === "0.00" ? "0.00" : `-${budgetExact}`,
    ]);
    return {
      category,
      budgetExact,
      actualExact,
      difference,
      budget: Number(budgetExact),
      actual: Number(actualExact),
    };
  }).sort(
    (a, b) => Math.max(b.budget, b.actual) - Math.max(a.budget, a.actual),
  );
}

/** Positive slices retain their source index; zero values never claim chart area. */
export function pieSlices(amounts: string[]) {
  const positive = amounts
    .map((amount, index) => ({ value: Number(amount), index }))
    .filter(({ value }) => Number.isFinite(value) && value > 0);
  const sum = positive.reduce((total, item) => total + item.value, 0);
  if (!Number.isFinite(sum) || sum <= 0) return [];
  let startAngle = 0;
  return positive.map(({ value, index }, sliceIndex) => {
    const endAngle =
      sliceIndex === positive.length - 1
        ? 360
        : startAngle + (value / sum) * 360;
    const slice = { index, startAngle, endAngle };
    startAngle = endAngle;
    return slice;
  });
}
