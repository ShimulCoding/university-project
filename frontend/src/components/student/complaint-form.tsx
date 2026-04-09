"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import type { PublicEvent } from "@/types";
import { ApiError } from "@/lib/api/shared";
import { postFormData } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function ComplaintForm({ events }: { events: PublicEvent[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const initialEventId = searchParams.get("eventId") ?? "";

  const handleSubmit = async (submitEvent: React.FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();

    const formData = new FormData(submitEvent.currentTarget);
    const selectedEventId = formData.get("eventId");

    if (!selectedEventId) {
      formData.delete("eventId");
    }

    try {
      setErrorMessage(null);
      await postFormData("/complaints", formData);

      formRef.current?.reset();
      startTransition(() => {
        router.push("/complaints");
        router.refresh();
      });
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError ? error.message : "Unable to submit the complaint.",
      );
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
          >
            <Select
              name="eventId"
              defaultValue={initialEventId}
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
          >
            <Input name="subject" placeholder="Summarize the issue" required />
          </Field>
          <Field
            label="Description"
            description="Explain what happened, why it matters, and any details the reviewer should consider."
          >
            <Textarea
              name="description"
              rows={6}
              placeholder="Describe the issue clearly and factually."
              required
            />
          </Field>
          <Field
            label="Evidence file"
            description="Optional. Supported files are handled privately and not exposed in public pages."
          >
            <Input name="evidence" type="file" />
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
