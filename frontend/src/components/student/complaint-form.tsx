"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import type { PublicEvent } from "@/types";
import { getApiErrorMessage } from "@/lib/api/shared";
import { postFormData } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type ComplaintFieldErrors = Partial<Record<"eventId" | "subject" | "description" | "evidence", string>>;

export function ComplaintForm({ events }: { events: PublicEvent[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ComplaintFieldErrors>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const initialEventId = searchParams.get("eventId") ?? "";

  const clearFieldError = (field: keyof ComplaintFieldErrors) => {
    setErrorMessage(null);
    setFieldErrors((current) => ({
      ...current,
      [field]: undefined,
    }));
  };

  const handleSubmit = async (submitEvent: React.FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();

    const formData = new FormData(submitEvent.currentTarget);
    const selectedEventId = formData.get("eventId")?.toString().trim() ?? "";
    const subject = formData.get("subject")?.toString().trim() ?? "";
    const description = formData.get("description")?.toString().trim() ?? "";
    const nextFieldErrors: ComplaintFieldErrors = {};

    if (subject.length < 3) {
      nextFieldErrors.subject = "Subject must be at least 3 characters long.";
    }

    if (description.length < 10) {
      nextFieldErrors.description = "Description must be at least 10 characters long.";
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setErrorMessage("Please correct the highlighted complaint details.");
      return;
    }

    if (!selectedEventId) {
      formData.delete("eventId");
    } else {
      formData.set("eventId", selectedEventId);
    }

    try {
      setErrorMessage(null);
      setFieldErrors({});
      formData.set("subject", subject);
      formData.set("description", description);
      await postFormData("/complaints", formData);

      formRef.current?.reset();
      startTransition(() => {
        router.push("/complaints");
        router.refresh();
      });
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, "Unable to submit the complaint."));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Submit a complaint</CardTitle>
        <CardDescription>
          Complaints stay private, evidence stays protected, and the routing history is
          preserved internally after submission.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={formRef} className="grid gap-5" onSubmit={handleSubmit}>
          <Field
            label="Related event"
            description="Optional. Choose an event if your complaint is tied to a specific activity."
            error={fieldErrors.eventId}
          >
            <Select
              name="eventId"
              defaultValue={initialEventId}
              onChange={() => clearFieldError("eventId")}
              aria-invalid={Boolean(fieldErrors.eventId)}
              options={[
                { value: "", label: "No specific event selected" },
                ...events.map((event) => ({
                  value: event.id,
                  label: event.title,
                })),
              ]}
            />
          </Field>
          <Field
            label="Subject"
            description="Keep the title concise and specific."
            error={fieldErrors.subject}
          >
            <Input
              name="subject"
              placeholder="Summarize the issue"
              minLength={3}
              maxLength={200}
              onChange={() => clearFieldError("subject")}
              aria-invalid={Boolean(fieldErrors.subject)}
              required
            />
          </Field>
          <Field
            label="Description"
            description="Explain what happened, why it matters, and any details the reviewer should consider."
            error={fieldErrors.description}
          >
            <Textarea
              name="description"
              rows={6}
              placeholder="Describe the issue clearly and factually."
              minLength={10}
              maxLength={5000}
              onChange={() => clearFieldError("description")}
              aria-invalid={Boolean(fieldErrors.description)}
              required
            />
          </Field>
          <Field
            label="Evidence file"
            description="Optional. Supported files are handled privately and not exposed in public pages."
            error={fieldErrors.evidence}
          >
            <Input
              name="evidence"
              type="file"
              accept="image/*,.pdf"
              onChange={() => clearFieldError("evidence")}
              aria-invalid={Boolean(fieldErrors.evidence)}
            />
          </Field>
          {errorMessage ? (
            <div className="rounded-[1rem] border border-destructive/15 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {errorMessage}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Submitting complaint..." : "Submit complaint"}
            </Button>
            <span className="text-sm text-muted-foreground">
              Complaint evidence and routing notes remain protected after submission.
            </span>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
