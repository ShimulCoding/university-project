"use client";

import { useRef } from "react";

import type { EventSummary } from "@/types";
import { postFormData, postJson } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FeedbackMessage, useActionState } from "@/components/internal/action-utils";

type EventOption = Pick<EventSummary, "id" | "title">;

export function PaymentDecisionForm({
  paymentProofId,
}: {
  paymentProofId: string;
}) {
  const { feedback, isPending, clearFeedback, runAction } = useActionState();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Verification decision</CardTitle>
        <CardDescription>
          Move this proof into a verified or rejected state with an explicit reviewer remark.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);

            void runAction(
              () =>
                postJson(`/payments/proofs/${paymentProofId}/decision`, {
                  decision: formData.get("decision"),
                  remark: formData.get("remark")?.toString().trim() || undefined,
                }),
              "Payment proof decision saved.",
            );
          }}
        >
          <Field label="Decision">
            <Select
              name="decision"
              onChange={clearFeedback}
              options={[
                { value: "APPROVE", label: "Approve proof" },
                { value: "REJECT", label: "Reject proof" },
              ]}
            />
          </Field>
          <Field
            label="Reviewer remark"
            description="Required when rejecting. This note remains inside the protected workflow."
          >
            <Textarea
              name="remark"
              rows={4}
              placeholder="Explain the review decision clearly."
              onChange={clearFeedback}
            />
          </Field>
          <FeedbackMessage feedback={feedback} />
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving decision..." : "Save decision"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function IncomeRecordForm({
  events,
}: {
  events: EventOption[];
}) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const { feedback, isPending, clearFeedback, runAction } = useActionState();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Record manual income</CardTitle>
        <CardDescription>
          Create sponsor, donation, university support, or other approved event-linked income.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <form
          ref={formRef}
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);

            void runAction(async () => {
              await postFormData("/payments/income-records", formData);
              formRef.current?.reset();
            }, "Income record created.");
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
            <Field label="Source type">
              <Select
                name="sourceType"
                onChange={clearFeedback}
                options={[
                  { value: "SPONSOR", label: "Sponsor" },
                  { value: "DONATION", label: "Donation" },
                  { value: "UNIVERSITY_SUPPORT", label: "University support" },
                  { value: "MANUAL_OTHER", label: "Other approved source" },
                ]}
              />
            </Field>
            <Field label="Amount">
              <Input
                name="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 1500.00"
                onChange={clearFeedback}
                required
              />
            </Field>
          </div>
          <Field label="Source label">
            <Input
              name="sourceLabel"
              placeholder="e.g. Alumni donation batch"
              onChange={clearFeedback}
              required
            />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Collected date">
              <Input name="collectedAt" type="date" onChange={clearFeedback} />
            </Field>
            <Field label="Evidence file">
              <Input
                name="evidenceFile"
                type="file"
                accept="image/*,.pdf"
                onChange={clearFeedback}
              />
            </Field>
          </div>
          <Field label="Reference note">
            <Textarea
              name="referenceText"
              rows={4}
              placeholder="Add the protected context behind this income record."
              onChange={clearFeedback}
            />
          </Field>
          <FeedbackMessage feedback={feedback} />
          <Button type="submit" disabled={isPending}>
            {isPending ? "Recording income..." : "Create income record"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
