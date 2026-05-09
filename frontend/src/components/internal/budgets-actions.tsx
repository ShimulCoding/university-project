"use client";

import { useEffect, useMemo, useState } from "react";

import type { BudgetRecord, EventSummary } from "@/types";
import { patchJson, postJson } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FeedbackMessage, useActionState } from "@/components/internal/action-utils";

type EventOption = Pick<EventSummary, "id" | "title">;

type BudgetDraftItem = {
  category: string;
  label: string;
  amount: string;
  notes: string;
};

function BudgetItemEditor({
  items,
  setItems,
  onChangeStart,
}: {
  items: BudgetDraftItem[];
  setItems: React.Dispatch<React.SetStateAction<BudgetDraftItem[]>>;
  onChangeStart: () => void;
}) {
  const updateItem = (index: number, key: keyof BudgetDraftItem, value: string) => {
    onChangeStart();
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [key]: value,
            }
          : item,
      ),
    );
  };

  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <div
          key={index}
          className="rounded-[1.15rem] border border-border/70 bg-panel-muted p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-foreground">Budget item {index + 1}</div>
            {items.length > 1 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onChangeStart();
                  setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
                }}
              >
                Remove
              </Button>
            ) : null}
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Category">
              <Input
                value={item.category}
                onChange={(event) => updateItem(index, "category", event.target.value)}
                required
              />
            </Field>
            <Field label="Amount">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={item.amount}
                onChange={(event) => updateItem(index, "amount", event.target.value)}
                required
              />
            </Field>
          </div>
          <div className="mt-4 grid gap-4">
            <Field label="Label">
              <Input
                value={item.label}
                onChange={(event) => updateItem(index, "label", event.target.value)}
                required
              />
            </Field>
            <Field label="Notes">
              <Textarea
                rows={3}
                value={item.notes}
                onChange={(event) => updateItem(index, "notes", event.target.value)}
              />
            </Field>
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          onChangeStart();
          setItems((current) => [
            ...current,
            {
              category: "",
              label: "",
              amount: "",
              notes: "",
            },
          ]);
        }}
      >
        Add item
      </Button>
    </div>
  );
}

export function BudgetComposerForm({
  events,
  budget,
}: {
  events: EventOption[];
  budget?: BudgetRecord;
}) {
  const initialItems =
    budget?.items.map((item) => ({
      category: item.category,
      label: item.label,
      amount: item.amount,
      notes: item.notes ?? "",
    })) ?? [
      {
        category: "",
        label: "",
        amount: "",
        notes: "",
      },
    ];
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [title, setTitle] = useState(budget?.title ?? "");
  const [items, setItems] = useState<BudgetDraftItem[]>(initialItems);
  const [shouldSubmit, setShouldSubmit] = useState(false);
  const { feedback, isPending, clearFeedback, runAction } = useActionState();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">
          {budget ? "Create budget revision" : "Create budget request"}
        </CardTitle>
        <CardDescription>
          Event managers submit full budget versions with item-level detail for approver review.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {!budget ? (
          <Field label="Event">
            <Select
              value={eventId}
              onChange={(event) => {
                clearFeedback();
                setEventId(event.target.value);
              }}
              options={events.map((item) => ({
                value: item.id,
                label: item.title,
              }))}
            />
          </Field>
        ) : null}
        <Field label="Budget title">
          <Input
            value={title}
            onChange={(event) => {
              clearFeedback();
              setTitle(event.target.value);
            }}
            placeholder="Optional budget title"
          />
        </Field>
        <BudgetItemEditor items={items} setItems={setItems} onChangeStart={clearFeedback} />
        <label className="flex items-center gap-3 rounded-[1rem] border border-border/70 bg-panel-muted px-4 py-3 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={shouldSubmit}
            onChange={(event) => {
              clearFeedback();
              setShouldSubmit(event.target.checked);
            }}
          />
          Mark this budget as submitted immediately after creation.
        </label>
        <FeedbackMessage feedback={feedback} />
        <Button
          disabled={isPending}
          onClick={() =>
            void runAction(
              async () => {
                const payload = {
                  ...(budget ? {} : { eventId }),
                  title: title.trim() || undefined,
                  items: items.map((item) => ({
                    category: item.category.trim(),
                    label: item.label.trim(),
                    amount: item.amount.trim(),
                    notes: item.notes.trim() || undefined,
                  })),
                  submit: shouldSubmit,
                };

                if (budget) {
                  await postJson(`/budgets/${budget.id}/revisions`, payload);
                } else {
                  await postJson("/budgets", payload);
                  setItems([
                    {
                      category: "",
                      label: "",
                      amount: "",
                      notes: "",
                    },
                  ]);
                  setTitle("");
                  setShouldSubmit(false);
                }
              },
              budget ? "Budget revision created." : "Budget created.",
            )
          }
        >
          {isPending ? "Saving budget..." : budget ? "Create revision" : "Create budget"}
        </Button>
      </CardContent>
    </Card>
  );
}

export function BudgetStateForm({
  budget,
  canSubmit,
  canApprove,
  canReturn,
}: {
  budget: BudgetRecord;
  canSubmit: boolean;
  canApprove: boolean;
  canReturn: boolean;
}) {
  const availableOptions = useMemo(() => {
    if (budget.state === "DRAFT" && canSubmit) {
      return [{ value: "SUBMITTED", label: "Submitted" }] as const;
    }

    if (budget.state === "SUBMITTED" && canApprove) {
      return [
        { value: "APPROVED", label: "Approve as final budget" },
        ...(canReturn ? [{ value: "REVISED" as const, label: "Return for revision" }] : []),
      ] as const;
    }

    return [];
  }, [budget.state, canApprove, canSubmit, canReturn]);
  const [state, setState] = useState<"SUBMITTED" | "APPROVED" | "REVISED" | "">(
    availableOptions[0]?.value ?? "",
  );
  const { feedback, isPending, clearFeedback, runAction } = useActionState();
  const guidanceMessage =
    budget.state === "DRAFT" && !canSubmit
      ? "The event manager must submit this budget version before approval."
      : budget.state === "SUBMITTED" && !canApprove
        ? "This budget version is waiting for an organizational approver."
        : budget.isActive
          ? "This approved budget is the final budget for the event."
          : budget.state === "APPROVED"
            ? "This budget is approved and should appear under the final budgets view."
            : budget.state === "REVISED"
              ? "This budget was returned for revision. Create a new revision and resubmit it."
              : null;

  useEffect(() => {
    setState(availableOptions[0]?.value ?? "");
  }, [availableOptions]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Budget controls</CardTitle>
        <CardDescription>
          Activation and state changes remain explicit so versions are never silently overwritten.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 pt-0">
        {availableOptions.length > 0 ? (
          <>
            <Field label="State">
              <Select
                value={state}
                onChange={(event) => {
                  clearFeedback();
                  setState(event.target.value as "SUBMITTED" | "APPROVED" | "REVISED");
                }}
                options={[...availableOptions]}
              />
            </Field>
            <div className="flex flex-wrap gap-3">
              <Button
                disabled={isPending}
                onClick={() =>
                  void runAction(
                    () =>
                      patchJson(`/budgets/${budget.id}/state`, {
                        state,
                      }),
                    state === "APPROVED"
                      ? "Budget approved and finalized."
                      : state === "REVISED"
                        ? "Budget returned for revision."
                        : "Budget submitted for review.",
                  )
                }
              >
                {isPending ? "Updating state..." : "Update state"}
              </Button>
            </div>
          </>
        ) : null}
        {availableOptions.length === 0 && guidanceMessage ? (
          <div className="rounded-[1rem] border border-border/70 bg-panel-muted px-4 py-4 text-sm leading-6 text-muted-foreground">
            {guidanceMessage}
          </div>
        ) : null}
        <FeedbackMessage feedback={feedback} />
      </CardContent>
    </Card>
  );
}
