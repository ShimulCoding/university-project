"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { PublicEvent } from "@/types";
import { ApiError } from "@/lib/api/shared";
import { postJson } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function RegistrationForm({ event }: { event: PublicEvent }) {
  const router = useRouter();
  const [studentId, setStudentId] = useState("");
  const [phone, setPhone] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = async (submitEvent: React.FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();

    try {
      setErrorMessage(null);
      const response = await postJson<{ registration: { id: string } }>("/registrations", {
        eventId: event.id,
        studentId,
        phone,
      });

      startTransition(() => {
        router.push(`/registrations/${response.registration.id}`);
        router.refresh();
      });
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError ? error.message : "Unable to create the registration.",
      );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Create your registration</CardTitle>
        <CardDescription>
          This action creates your participant-event link and opens the student-owned
          payment proof workflow for this event.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-5" onSubmit={handleSubmit}>
          <Field
            label="Student ID"
            description="This must be unique within the selected event."
          >
            <Input
              value={studentId}
              onChange={(event) => setStudentId(event.target.value)}
              placeholder="e.g. 221-15-0001"
              required
            />
          </Field>
          <Field
            label="Phone number"
            description="Optional, but useful if event coordination needs to contact you."
          >
            <Input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="e.g. 8801XXXXXXXXX"
            />
          </Field>
          {errorMessage ? (
            <div className="rounded-[1rem] border border-destructive/15 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {errorMessage}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating registration..." : "Register for this event"}
            </Button>
            <span className="text-sm text-muted-foreground">
              Registration stays private to your student session and internal reviewers.
            </span>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
