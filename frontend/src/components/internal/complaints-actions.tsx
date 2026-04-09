"use client";

import { useState } from "react";

import type { AppRole } from "@/types";
import { postJson } from "@/lib/api/client";
import { formatEnumLabel } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FeedbackMessage, useActionState } from "@/components/internal/action-utils";

type ComplaintAction = "review" | "route" | "escalate" | "resolve" | "close";

export function ComplaintWorkflowPanel({
  complaintId,
}: {
  complaintId: string;
}) {
  const [action, setAction] = useState<ComplaintAction>("review");
  const [note, setNote] = useState("");
  const [toRoleCode, setToRoleCode] = useState<AppRole>("COMPLAINT_REVIEW_AUTHORITY");
  const { feedback, isPending, clearFeedback, runAction } = useActionState();

  const roleOptions = [
    "SYSTEM_ADMIN",
    "COMPLAINT_REVIEW_AUTHORITY",
    "ORGANIZATIONAL_APPROVER",
  ].map((role) => ({
    value: role,
    label: formatEnumLabel(role),
  }));

  const actionMeta: Record<ComplaintAction, { endpoint: string; successMessage: string }> = {
    review: {
      endpoint: `/complaints/${complaintId}/review`,
      successMessage: "Complaint moved into review.",
    },
    route: {
      endpoint: `/complaints/${complaintId}/route`,
      successMessage: "Complaint routed successfully.",
    },
    escalate: {
      endpoint: `/complaints/${complaintId}/escalate`,
      successMessage: "Complaint escalated successfully.",
    },
    resolve: {
      endpoint: `/complaints/${complaintId}/resolve`,
      successMessage: "Complaint marked as resolved.",
    },
    close: {
      endpoint: `/complaints/${complaintId}/close`,
      successMessage: "Complaint closed.",
    },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Complaint workflow actions</CardTitle>
        <CardDescription>
          Review, routing, escalation, resolution, and closure remain protected and auditable.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 pt-0">
        <Field label="Action">
          <Select
            value={action}
            onChange={(event) => {
              clearFeedback();
              setAction(event.target.value as ComplaintAction);
            }}
            options={[
              { value: "review", label: "Start review" },
              { value: "route", label: "Route complaint" },
              { value: "escalate", label: "Escalate complaint" },
              { value: "resolve", label: "Resolve complaint" },
              { value: "close", label: "Close complaint" },
            ]}
          />
        </Field>
        {action === "route" || action === "escalate" ? (
          <Field label="Target role">
            <Select
              value={toRoleCode}
              onChange={(event) => {
                clearFeedback();
                setToRoleCode(event.target.value as AppRole);
              }}
              options={roleOptions}
            />
          </Field>
        ) : null}
        <Field label="Protected note">
          <Textarea
            rows={4}
            value={note}
            onChange={(event) => {
              clearFeedback();
              setNote(event.target.value);
            }}
            placeholder="Add protected reviewer context."
          />
        </Field>
        <FeedbackMessage feedback={feedback} />
        <Button
          disabled={isPending}
          onClick={() =>
            void runAction(
              () =>
                postJson(actionMeta[action].endpoint, {
                  ...(action === "route" || action === "escalate" ? { toRoleCode } : {}),
                  note: note || undefined,
                }),
              actionMeta[action].successMessage,
            )
          }
        >
          {isPending ? "Saving action..." : "Apply complaint action"}
        </Button>
      </CardContent>
    </Card>
  );
}
