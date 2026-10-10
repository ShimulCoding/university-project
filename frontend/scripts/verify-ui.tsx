import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";

import PageError from "../src/app/error";
import { queryPage } from "../src/lib/api/list";
import { Field } from "../src/components/ui/field";
import { Input } from "../src/components/ui/input";
import { Select } from "../src/components/ui/select";
import { Button } from "../src/components/ui/button";
import { SegmentedControl } from "../src/components/ui/segmented-control";
import { ParticipationSteps } from "../src/components/student/participation-steps";
import { sumExactMoney, formatEnumLabel } from "../src/lib/format";
import { buildCategoryPairs } from "../src/lib/charts";
import { ExpenseBudgetActualChart } from "../src/components/public/expense-budget-actual-chart";
import { IncomePieChart } from "../src/components/public/income-pie-chart";

// A segment error boundary is rendered inside the existing document layout.
const markup = renderToStaticMarkup(
  <PageError
    error={Object.assign(new Error("Private failure details"), {
      digest: "audit-digest",
    })}
    reset={() => {}}
  />,
);
assert(
  !/<\/?(?:html|body)(?:\s|>)/i.test(markup),
  "Segment errors must not nest document elements",
);
assert(markup.includes("audit-digest"));
assert(
  !markup.includes("Private failure details"),
  "Do not expose raw server errors",
);
assert(markup.includes("Retry page") && markup.includes("Return home"));
assert.equal(queryPage("2"), "2");
for (const invalid of [
  undefined,
  "0",
  "-1",
  "1.5",
  "9007199254740992",
  ["2", "3"],
])
  assert.equal(queryPage(invalid), "1");
const field = renderToStaticMarkup(
  <Field label="Amount" description="Use BDT" error="Enter an amount">
    <Input name="amount" />
  </Field>,
);
assert(field.includes('aria-invalid="true"'));
assert(
  field.includes('aria-describedby="') &&
    field.includes("-help") &&
    field.includes("-error"),
);
assert(
  field.includes('role="alert"') &&
    /<input[^>]*class="[^"]*\bborder\b/.test(field),
);
assert(
  !field.match(/<label[^>]*>(.*?)<\/label>/s)?.[1]?.includes("<input"),
  "Labels should not contain password toggle buttons or other controls",
);
const suggestions = renderToStaticMarkup(
  <Field label="Payee">
    <Input id="payee" list="payee-options" />
    <datalist id="payee-options">
      <option value="Venue" />
    </datalist>
  </Field>,
);
const selection = renderToStaticMarkup(
  <Field label="Stage">
    <Select
      id="stage"
      name="state"
      options={[{ value: "draft", label: "Draft" }]}
    />
  </Field>,
);
assert(
  selection.includes('for="stage"') && /<select[^>]*id="stage"/.test(selection),
  "Select labels must target the native control",
);
assert(
  suggestions.includes('for="payee"') &&
    suggestions.includes('id="payee-options"'),
  "Suggestion fields lost their explicit label or datalist",
);
assert(
  renderToStaticMarkup(<Button size="sm">Action</Button>).includes("min-h-11"),
);
assert(
  renderToStaticMarkup(
    <SegmentedControl
      value="login"
      onValueChange={() => {}}
      options={[{ value: "login", label: "Sign in" }]}
    />,
  ).includes('aria-pressed="true"'),
);
assert.equal(
  (
    renderToStaticMarkup(<ParticipationSteps current={1} />).match(
      /aria-current="step"/g,
    ) ?? []
  ).length,
  1,
);
assert(
  !renderToStaticMarkup(<ParticipationSteps current={2} complete />).includes(
    'aria-current="step"',
  ),
);
assert.equal(
  sumExactMoney(["9999999999999999.99", "0.01"]),
  "10000000000000000.00",
);
assert.equal(sumExactMoney(["-1.10", "0.20"]), "-0.90");
assert.equal(sumExactMoney([]), "0.00");
assert.throws(() => sumExactMoney(["NaN"]));
assert.equal(formatEnumLabel("EVENT_MANAGEMENT_USER"), "Event Manager");
const categoryLine = {
  key: "large",
  label: "Venue",
  segment: "Venue",
  recordCount: 1,
};
const pairs = buildCategoryPairs(
  [
    { ...categoryLine, amount: "9999999999999999.99" },
    { ...categoryLine, key: "cent", amount: "0.02" },
  ],
  [{ ...categoryLine, amount: "9999999999999999.99" }],
);
assert.equal(pairs[0]?.actualExact, "10000000000000000.01");
assert.equal(pairs[0]?.budgetExact, "9999999999999999.99");
assert.equal(
  pairs[0]?.difference,
  "0.02",
  "Large chart values lost their exact difference",
);
assert.deepEqual(buildCategoryPairs([], []), []);
const smallChart = renderToStaticMarkup(
  <ExpenseBudgetActualChart
    title="Small amounts"
    description="Regression fixture"
    expenseItems={[{ ...categoryLine, amount: "0.01" }]}
    budgetItems={[{ ...categoryLine, amount: "0.02" }]}
  />,
);
const largePie = renderToStaticMarkup(
  <IncomePieChart
    title="Income"
    description="Large total"
    total="9999999999999999.99"
    items={[{ ...categoryLine, amount: "9999999999999999.99" }]}
  />,
);
assert(
  largePie.includes("9,999,999,999,999,999.99"),
  "The pie chart lost its exact visible total",
);
assert(
  !/<svg[\s\S]*?9,999,999,999,999,999\.99[\s\S]*?<\/svg>/.test(largePie),
  "A large total crowded the pie chart center",
);
assert(
  smallChart.includes(">0.25</text>") && smallChart.includes(">0.75</text>"),
  "Small chart axes rounded distinct fractional ticks",
);
console.log(
  "UI verification passed: error recovery, page queries, accessible fields, control sizes, account modes, progress, exact totals, and role labels.",
);
