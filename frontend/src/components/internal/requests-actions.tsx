"use client";

import { useRef, useState } from "react";
import { Send, ShieldCheck } from "lucide-react";

import type { EventSummary, ExpenseRequestRecord } from "@/types";
import { postEmpty, postFormData, postJson } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FeedbackMessage, useActionState } from "@/components/internal/action-utils";

type EventOption = Pick<EventSummary, "id" | "title">;

export function BudgetRequestForm({
  events,
}: {
  events: EventOption[];
}) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [submitNow, setSubmitNow] = useState(true);
  const { feedback, isPending, clearFeedback, runAction } = useActionState();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Create budget request</CardTitle>
        <CardDescription>
          Use this when budget authority is needed before operational spending is approved.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <form
          ref={formRef}
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);

            if (submitNow) {
              formData.set("submit", "true");
            } else {
              formData.delete("submit");
            }

            void runAction(async () => {
              await postFormData("/requests/budget-requests", formData);
              formRef.current?.reset();
              setSubmitNow(true);
            }, "Budget request created.");
          }}
        >
          <Field label="Event">
            <Select
              name="eventId"
              onChange={clearFeedback}
              options={events.map((item) => ({
                value: item.id,
                label: item.title,
              }))}
            />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Amount">
              <Input
                name="amount"
                type="number"
                min="0"
                step="0.01"
                onChange={clearFeedback}
                required
              />
            </Field>
            <Field label="Supporting document">
              <Input
                name="supportingDocument"
                type="file"
                accept="image/*,.pdf"
                onChange={clearFeedback}
              />
            </Field>
          </div>
          <Field label="Purpose">
            <Input
              name="purpose"
              placeholder="Why is the budget request needed?"
              onChange={clearFeedback}
              required
            />
          </Field>
          <Field label="Justification">
            <Textarea
              name="justification"
              rows={4}
              placeholder="Add the protected internal context behind the request."
              onChange={clearFeedback}
            />
          </Field>
          <label className="flex items-center gap-3 rounded-[1rem] border border-border/70 bg-panel-muted px-4 py-3 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={submitNow}
              onChange={(event) => {
                clearFeedback();
                setSubmitNow(event.target.checked);
              }}
            />
            Submit this request immediately after creation.
          </label>
          <FeedbackMessage feedback={feedback} />
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving request..." : "Create budget request"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function ExpenseRequestForm({
  events,
}: {
  events: EventOption[];
}) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [submitNow, setSubmitNow] = useState(true);
  const { feedback, isPending, clearFeedback, runAction } = useActionState();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Create expense request</CardTitle>
        <CardDescription>
          Request expense approval before any actual settlement is recorded.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <form
          ref={formRef}
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);

            if (submitNow) {
              formData.set("submit", "true");
            } else {
              formData.delete("submit");
            }

            void runAction(async () => {
              await postFormData("/requests/expense-requests", formData);
              formRef.current?.reset();
              setSubmitNow(true);
            }, "Expense request created.");
          }}
        >
          <Field label="Event">
            <Select
              name="eventId"
              onChange={clearFeedback}
              options={events.map((item) => ({
                value: item.id,
                label: item.title,
              }))}
            />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Amount">
              <Input
                name="amount"
                type="number"
                min="0"
                step="0.01"
                onChange={clearFeedback}
                required
              />
            </Field>
            <Field label="Category">
              <Input
                name="category"
                placeholder="e.g. Logistics"
                onChange={clearFeedback}
                required
              />
            </Field>
          </div>
          <Field label="Purpose">
            <Input
              name="purpose"
              placeholder="What is this expense for?"
              onChange={clearFeedback}
              required
            />
          </Field>
          <Field label="Justification">
            <Textarea
              name="justification"
              rows={4}
              placeholder="Add operational context for the approver."
              onChange={clearFeedback}
            />
          </Field>
          <Field label="Supporting document">
            <Input
              name="supportingDocument"
              type="file"
              accept="image/*,.pdf"
              onChange={clearFeedback}
            />
          </Field>
          <label className="flex items-center gap-3 rounded-[1rem] border border-border/70 bg-panel-muted px-4 py-3 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={submitNow}
              onChange={(event) => {
                clearFeedback();
                setSubmitNow(event.target.checked);
              }}
            />
            Submit this request immediately after creation.
          </label>
          <FeedbackMessage feedback={feedback} />
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving request..." : "Create expense request"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function SubmitRequestButton({
  endpoint,
  label,
}: {
  endpoint: string;
  label: string;
}) {
  const { feedback, isPending, runAction } = useActionState();

  return (
    <Card tone="muted">
      <CardHeader>
        <CardTitle className="text-xl">Move into review</CardTitle>
        <CardDescription>
          Submission makes the request visible to the next protected review step.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 pt-0">
        <FeedbackMessage feedback={feedback} />
        <Button
          disabled={isPending}
          onClick={() => void runAction(() => postEmpty(endpoint), `${label} submitted.`)}
        >
          <Send className="h-4 w-4" />
          {isPending ? "Submitting..." : `Submit ${label.toLowerCase()}`}
        </Button>
      </CardContent>
    </Card>
  );
}

export function ExpenseRecordForm({
  events,
  expenseRequests,
}: {
  events: EventOption[];
  expenseRequests: Pick<ExpenseRequestRecord, "id" | "purpose" | "event">[];
}) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const { feedback, isPending, clearFeedback, runAction } = useActionState();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Create expense record</CardTitle>
        <CardDescription>
          Record actual spending separately from the earlier request and attach settlement evidence.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <form
          ref={formRef}
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);

            if (!formData.get("expenseRequestId")) {
              formData.delete("expenseRequestId");
            }

            void runAction(async () => {
              await postFormData("/requests/expense-records", formData);
              formRef.current?.reset();
            }, "Expense record created.");
          }}
        >
          <Field label="Event">
            <Select
              name="eventId"
              onChange={clearFeedback}
              options={events.map((item) => ({
                value: item.id,
                label: item.title,
              }))}
            />
          </Field>
          <Field label="Related approved expense request">
            <Select
              name="expenseRequestId"
              onChange={clearFeedback}
              options={[
                { value: "", label: "No linked request" },
                ...expenseRequests.map((request) => ({
                  value: request.id,
                  label: `${request.event.title} - ${request.purpose}`,
                })),
              ]}
            />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Amount">
              <Input
                name="amount"
                type="number"
                min="0"
                step="0.01"
                onChange={clearFeedback}
                required
              />
            </Field>
            <Field label="Category">
              <Input
                name="category"
                placeholder="e.g. Operations"
                onChange={clearFeedback}
                required
              />
            </Field>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Paid date">
              <Input name="paidAt" type="date" onChange={clearFeedback} />
            </Field>
            <Field label="Supporting document">
              <Input
                name="supportingDocument"
                type="file"
                accept="image/*,.pdf"
                onChange={clearFeedback}
              />
            </Field>
          </div>
          <Field label="Description">
            <Textarea
              name="description"
              rows={4}
              placeholder="Describe the actual settlement or disbursement."
              onChange={clearFeedback}
              required
            />
          </Field>
          <FeedbackMessage feedback={feedback} />
          <Button type="submit" disabled={isPending}>
            {isPending ? "Creating expense record..." : "Create expense record"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function ExpenseRecordStatePanel({
  expenseRecordId,
  allowSettle,
  allowVoid,
}: {
  expenseRecordId: string;
  allowSettle: boolean;
  allowVoid: boolean;
}) {
  const [paidAt, setPaidAt] = useState("");
  const [voidReason, setVoidReason] = useState("");
  const { feedback, isPending, clearFeedback, runAction } = useActionState();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Expense record controls</CardTitle>
        <CardDescription>
          Settlement and voiding remain explicit because the expense ledger feeds reconciliation.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 pt-0">
        {allowSettle ? (
          <div className="grid gap-3 rounded-[1rem] border border-border/70 bg-panel-muted p-4">
            <Field label="Settlement date">
              <Input
                type="date"
                value={paidAt}
                onChange={(event) => {
                  clearFeedback();
                  setPaidAt(event.target.value);
                }}
              />
            </Field>
            <Button
              disabled={isPending}
              onClick={() =>
                void runAction(
                  () =>
                    postJson(`/requests/expense-records/${expenseRecordId}/settle`, {
                      paidAt: paidAt || undefined,
                    }),
                  "Expense record settled.",
                )
              }
            >
              <ShieldCheck className="h-4 w-4" />
              {isPending ? "Settling..." : "Mark as settled"}
            </Button>
          </div>
        ) : null}
        {allowVoid ? (
          <div className="grid gap-3 rounded-[1rem] border border-border/70 bg-panel-muted p-4">
            <Field label="Void reason">
              <Textarea
                rows={3}
                value={voidReason}
                onChange={(event) => {
                  clearFeedback();
                  setVoidReason(event.target.value);
                }}
                placeholder="Explain why this record must be voided."
              />
            </Field>
            <Button
              variant="outline"
              disabled={isPending}
              onClick={() =>
                void runAction(
                  () =>
                    postJson(`/requests/expense-records/${expenseRecordId}/void`, {
                      reason: voidReason,
                    }),
                  "Expense record voided.",
                )
              }
            >
              {isPending ? "Voiding..." : "Void expense record"}
            </Button>
          </div>
        ) : null}
        <FeedbackMessage feedback={feedback} />
      </CardContent>
    </Card>
  );
}
