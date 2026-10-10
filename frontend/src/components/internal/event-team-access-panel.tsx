"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, ShieldCheck, UsersRound } from "lucide-react";

import type { UserProfile } from "@/types";
import { postJson } from "@/lib/api/client";
import { getApiErrorMessage } from "@/lib/api/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function EventTeamAccessPanel({ eventLookupKey }: { eventLookupKey: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [routingPending, startTransition] = useTransition();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      await postJson<{ user: UserProfile }>("/auth/event-team-login", {
        email: email.trim(),
        password,
        eventLookupKey,
      });

      setSuccessMessage("Assignment confirmed. Opening this event workspace...");
      setIsSubmitting(false);

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, "Unable to open this event workspace."),
      );
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/10 bg-primary/5 text-primary">
          <KeyRound className="h-5 w-5" />
        </div>
        <CardTitle className="mt-4 text-2xl">Event Team Sign In</CardTitle>
        <CardDescription>
          Sign in with the internal account assigned to this specific event. A valid account
          assigned only to another event cannot enter this workspace.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[1.15rem] border border-info/15 bg-info/5 px-4 py-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <UsersRound className="h-4 w-4 text-info" />
              Event-specific team
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Event Admin, Event Manager, Finance Controller, Approver, and Complaint Reviewer
              permissions are evaluated for this event only.
            </p>
          </div>
          <div className="rounded-[1.15rem] border border-success/15 bg-success-muted px-4 py-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <ShieldCheck className="h-4 w-4 text-success" />
              Scoped access
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Every list, detail, document, and action is checked again by the backend against
              the selected event assignment.
            </p>
          </div>
        </div>

        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <Field className="md:col-span-2" label="Assigned email">
            <Input
              type="email"
              value={email}
              onChange={(event) => {
                setErrorMessage(null);
                setSuccessMessage(null);
                setEmail(event.target.value);
              }}
              autoComplete="username"
              required
            />
          </Field>
          <Field className="md:col-span-2" label="Password">
            <Input
              type="password"
              value={password}
              onChange={(event) => {
                setErrorMessage(null);
                setSuccessMessage(null);
                setPassword(event.target.value);
              }}
              autoComplete="current-password"
              required
            />
          </Field>
          {errorMessage ? (
            <div className="md:col-span-2 rounded-[1rem] border border-destructive/15 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {errorMessage}
            </div>
          ) : null}
          {successMessage ? (
            <div className="md:col-span-2 rounded-[1rem] border border-success/15 bg-success-muted px-4 py-3 text-sm text-success">
              {successMessage}
            </div>
          ) : null}
          <div className="md:col-span-2 flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={isSubmitting || routingPending || email.trim().length === 0 || password.length < 8}>
              {isSubmitting || routingPending ? "Checking assignment..." : "Open event workspace"}
            </Button>
            <span className="text-sm text-muted-foreground">
              Event context: <span className="font-mono text-foreground">{eventLookupKey}</span>
            </span>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
