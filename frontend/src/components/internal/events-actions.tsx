"use client";

import { useState } from "react";

import type { EventStatus, ManagedEvent } from "@/types";
import { patchJson, postJson } from "@/lib/api/client";
import { formatEnumLabel } from "@/lib/format";
import { FeedbackMessage, useActionState } from "@/components/internal/action-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const eventStatusOptions: Array<{ value: EventStatus; label: string }> = [
  { value: "DRAFT", label: "Draft" },
  { value: "PUBLISHED", label: "Published" },
];

const eventTransitions: Record<EventStatus, EventStatus[]> = {
  DRAFT: ["PUBLISHED", "ARCHIVED"],
  PUBLISHED: ["REGISTRATION_CLOSED", "IN_PROGRESS", "COMPLETED", "ARCHIVED"],
  REGISTRATION_CLOSED: ["IN_PROGRESS", "COMPLETED", "ARCHIVED"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED: ["CLOSED"],
  CLOSED: ["ARCHIVED"],
  ARCHIVED: [],
};

function optionalDateTime(value: string) {
  return value ? new Date(value).toISOString() : undefined;
}

export function EventCreateForm() {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<EventStatus>("DRAFT");
  const [capacity, setCapacity] = useState("");
  const [registrationOpensAt, setRegistrationOpensAt] = useState("");
  const [registrationClosesAt, setRegistrationClosesAt] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const { feedback, isPending, clearFeedback, runAction } = useActionState();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Create event</CardTitle>
        <CardDescription>
          Only system admins and event managers can create or launch events. Published events
          become visible to students when the registration window is open.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Event title">
            <Input
              value={title}
              onChange={(event) => {
                clearFeedback();
                setTitle(event.target.value);
              }}
              placeholder="CSE Tech Fest 2026"
              required
            />
          </Field>
          <Field label="Optional slug">
            <Input
              value={slug}
              onChange={(event) => {
                clearFeedback();
                setSlug(event.target.value);
              }}
              placeholder="cse-tech-fest-2026"
            />
          </Field>
        </div>
        <Field label="Description">
          <Textarea
            rows={4}
            value={description}
            onChange={(event) => {
              clearFeedback();
              setDescription(event.target.value);
            }}
            placeholder="Describe the event purpose, audience, and public registration context."
          />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Initial status">
            <Select
              value={status}
              onChange={(event) => {
                clearFeedback();
                setStatus(event.target.value as EventStatus);
              }}
              options={eventStatusOptions}
            />
          </Field>
          <Field label="Capacity">
            <Input
              type="number"
              min="1"
              value={capacity}
              onChange={(event) => {
                clearFeedback();
                setCapacity(event.target.value);
              }}
              placeholder="Optional seat limit"
            />
          </Field>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Registration opens">
            <Input
              type="datetime-local"
              value={registrationOpensAt}
              onChange={(event) => {
                clearFeedback();
                setRegistrationOpensAt(event.target.value);
              }}
            />
          </Field>
          <Field label="Registration closes">
            <Input
              type="datetime-local"
              value={registrationClosesAt}
              onChange={(event) => {
                clearFeedback();
                setRegistrationClosesAt(event.target.value);
              }}
            />
          </Field>
          <Field label="Event starts">
            <Input
              type="datetime-local"
              value={startsAt}
              onChange={(event) => {
                clearFeedback();
                setStartsAt(event.target.value);
              }}
            />
          </Field>
          <Field label="Event ends">
            <Input
              type="datetime-local"
              value={endsAt}
              onChange={(event) => {
                clearFeedback();
                setEndsAt(event.target.value);
              }}
            />
          </Field>
        </div>
        <FeedbackMessage feedback={feedback} />
        <Button
          disabled={isPending || title.trim().length < 3}
          onClick={() =>
            void runAction(
              async () => {
                await postJson("/events", {
                  title: title.trim(),
                  slug: slug.trim() || undefined,
                  description: description.trim() || undefined,
                  status,
                  capacity: capacity ? Number(capacity) : undefined,
                  registrationOpensAt: optionalDateTime(registrationOpensAt),
                  registrationClosesAt: optionalDateTime(registrationClosesAt),
                  startsAt: optionalDateTime(startsAt),
                  endsAt: optionalDateTime(endsAt),
                });
                setTitle("");
                setSlug("");
                setDescription("");
                setStatus("DRAFT");
                setCapacity("");
                setRegistrationOpensAt("");
                setRegistrationClosesAt("");
                setStartsAt("");
                setEndsAt("");
              },
              status === "PUBLISHED"
                ? "Event created and published for public registration."
                : "Event draft created.",
            )
          }
        >
          {isPending ? "Creating event..." : "Create event"}
        </Button>
      </CardContent>
    </Card>
  );
}

export function EventStatusControl({ event }: { event: ManagedEvent }) {
  const options = eventTransitions[event.status].map((status) => ({
    value: status,
    label: formatEnumLabel(status),
  }));
  const [nextStatus, setNextStatus] = useState<EventStatus | "">(options[0]?.value ?? "");
  const { feedback, isPending, clearFeedback, runAction } = useActionState();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Lifecycle control</CardTitle>
        <CardDescription>
          Move this event through launch, completion, and closure without bypassing the backend
          transition rules.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {options.length > 0 ? (
          <>
            <Field label="Next status">
              <Select
                value={nextStatus}
                onChange={(event) => {
                  clearFeedback();
                  setNextStatus(event.target.value as EventStatus);
                }}
                options={options}
              />
            </Field>
            <FeedbackMessage feedback={feedback} />
            <Button
              disabled={isPending || !nextStatus}
              onClick={() =>
                void runAction(
                  () => patchJson(`/events/${event.slug}`, { status: nextStatus }),
                  "Event status updated.",
                )
              }
            >
              {isPending ? "Updating event..." : "Update event status"}
            </Button>
          </>
        ) : (
          <div className="rounded-[1rem] border border-border/70 bg-panel-muted px-4 py-4 text-sm leading-6 text-muted-foreground">
            This event has no further lifecycle transition available from its current status.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
