"use client";

import { useState } from "react";
import { RefreshCcw } from "lucide-react";

import type { EventSummary } from "@/types";
import { postEmpty, postJson } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { FeedbackMessage, useActionState } from "@/components/internal/action-utils";

type EventOption = Pick<EventSummary, "id" | "title">;

export function ReconciliationGenerateForm({
  events,
}: {
  events: EventOption[];
}) {
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const { feedback, isPending, clearFeedback, runAction } = useActionState();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Generate reconciliation draft</CardTitle>
        <CardDescription>
          Draft reports gather verified income and settled expense data before review.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 pt-0">
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
        <FeedbackMessage feedback={feedback} />
        <Button
          disabled={isPending}
          onClick={() =>
            void runAction(
              () =>
                postJson("/reconciliation/generate", {
                  eventId,
                }),
              "Reconciliation draft generated.",
            )
          }
        >
          <RefreshCcw className="h-4 w-4" />
          {isPending ? "Generating..." : "Generate report"}
        </Button>
      </CardContent>
    </Card>
  );
}

export function ReconciliationActionPanel({
  reportId,
  canReview,
  canFinalize,
  status,
}: {
  reportId: string;
  canReview: boolean;
  canFinalize: boolean;
  status: string;
}) {
  const { feedback, isPending, runAction } = useActionState();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Report progression</CardTitle>
        <CardDescription>
          Review and finalization are separate protected steps to preserve closure discipline.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 pt-0">
        <div className="flex flex-wrap gap-3">
          {canReview && status === "DRAFT" ? (
            <Button
              disabled={isPending}
              onClick={() =>
                void runAction(
                  () => postEmpty(`/reconciliation/${reportId}/review`),
                  "Reconciliation report reviewed.",
                )
              }
            >
              {isPending ? "Reviewing..." : "Mark as reviewed"}
            </Button>
          ) : null}
          {canFinalize && status === "REVIEWED" ? (
            <Button
              disabled={isPending}
              onClick={() =>
                void runAction(
                  () => postEmpty(`/reconciliation/${reportId}/finalize`),
                  "Reconciliation report finalized.",
                )
              }
            >
              {isPending ? "Finalizing..." : "Finalize report"}
            </Button>
          ) : null}
        </div>
        <FeedbackMessage feedback={feedback} />
      </CardContent>
    </Card>
  );
}

export function PublishSummaryButton({
  reportId,
}: {
  reportId: string;
}) {
  const { feedback, isPending, runAction } = useActionState();

  return (
    <Card tone="success">
      <CardHeader>
        <CardTitle className="text-xl">Publish public summary</CardTitle>
        <CardDescription>
          This creates the public-safe summary snapshot without exposing protected evidence.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 pt-0">
        <FeedbackMessage feedback={feedback} />
        <Button
          disabled={isPending}
          onClick={() =>
            void runAction(
              () => postEmpty(`/public/manage/financial-summaries/${reportId}/publish`),
              "Public financial summary published.",
            )
          }
        >
          {isPending ? "Publishing..." : "Publish summary"}
        </Button>
      </CardContent>
    </Card>
  );
}
