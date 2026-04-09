"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { PublicEvent } from "@/types";
import { getApiErrorMessage } from "@/lib/api/shared";
import { postJson } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type RegistrationFieldErrors = Partial<Record<"studentId" | "phone", string>>;

export function RegistrationForm({ event }: { event: PublicEvent }) {
  const router = useRouter();
  const [studentId, setStudentId] = useState("");
  const [phone, setPhone] = useState("");
  const [fieldErrors, setFieldErrors] = useState<RegistrationFieldErrors>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const clearFieldError = (field: keyof RegistrationFieldErrors) => {
    setErrorMessage(null);
    setFieldErrors((current) => ({
      ...current,
      [field]: undefined,
    }));
  };

  const handleSubmit = async (submitEvent: React.FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();
    const trimmedStudentId = studentId.trim();
    const trimmedPhone = phone.trim();
    const nextFieldErrors: RegistrationFieldErrors = {};

    if (trimmedStudentId.length < 3) {
      nextFieldErrors.studentId = "Student ID must be at least 3 characters long.";
    }

    if (trimmedPhone && trimmedPhone.length < 6) {
      nextFieldErrors.phone = "Phone number must be at least 6 characters if provided.";
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setErrorMessage("Please correct the highlighted registration details.");
      return;
    }

    try {
      setErrorMessage(null);
      setFieldErrors({});
      const response = await postJson<{ registration: { id: string } }>("/registrations", {
        eventId: event.id,
        studentId: trimmedStudentId,
        phone: trimmedPhone || undefined,
      });

      startTransition(() => {
        router.push(`/registrations/${response.registration.id}`);
        router.refresh();
      });
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, "Unable to create the registration."));
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
            error={fieldErrors.studentId}
          >
            <Input
              value={studentId}
              onChange={(event) => {
                clearFieldError("studentId");
                setStudentId(event.target.value);
              }}
              placeholder="e.g. 221-15-0001"
              minLength={3}
              maxLength={40}
              aria-invalid={Boolean(fieldErrors.studentId)}
              required
            />
          </Field>
          <Field
            label="Phone number"
            description="Optional, but useful if event coordination needs to contact you."
            error={fieldErrors.phone}
          >
            <Input
              value={phone}
              onChange={(event) => {
                clearFieldError("phone");
                setPhone(event.target.value);
              }}
              placeholder="e.g. 8801XXXXXXXXX"
              minLength={6}
              maxLength={30}
              aria-invalid={Boolean(fieldErrors.phone)}
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
