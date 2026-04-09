"use client";

import { useState } from "react";

import type { ApprovalQueueItem } from "@/types";
import { postJson } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FeedbackMessage, useActionState } from "@/components/internal/action-utils";

export function ApprovalDecisionForm({
  item,
}: {
  item: ApprovalQueueItem;
}) {
  const [decision, setDecision] = useState("APPROVED");
  const [comment, setComment] = useState("");
  const { feedback, isPending, clearFeedback, runAction } = useActionState();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Decision view</CardTitle>
        <CardDescription>
          Approvals remain explicit and auditable. Reject or return actions require a comment.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 pt-0">
        <Field label="Decision">
          <Select
            value={decision}
            onChange={(event) => {
              clearFeedback();
              setDecision(event.target.value as "APPROVED" | "RETURNED" | "REJECTED");
            }}
            options={[
              { value: "APPROVED", label: "Approve" },
              { value: "RETURNED", label: "Return for revision" },
              { value: "REJECTED", label: "Reject" },
            ]}
          />
        </Field>
        <Field label="Comment">
          <Textarea
            rows={4}
            value={comment}
            onChange={(event) => {
              clearFeedback();
              setComment(event.target.value);
            }}
            placeholder="Add the protected decision context."
          />
        </Field>
        <FeedbackMessage feedback={feedback} />
        <Button
          disabled={isPending}
          onClick={() =>
            void runAction(
              () =>
                postJson(`/approvals/${item.entityType}/${item.entityId}/decisions`, {
                  decision,
                  comment,
                }),
              "Approval decision recorded.",
            )
          }
        >
          {isPending ? "Saving decision..." : "Save approval decision"}
        </Button>
      </CardContent>
    </Card>
  );
}
