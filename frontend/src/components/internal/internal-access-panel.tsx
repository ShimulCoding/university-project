"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, ShieldCheck, UserCog, Users } from "lucide-react";

import { getApiErrorMessage } from "@/lib/api/shared";
import { postJson } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function InternalAccessPanel() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, startTransition] = useTransition();
  const isBusy = isSubmitting;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      await postJson("/auth/internal-login", {
        email: email.trim(),
        password,
      });

      setSuccessMessage("Signed in successfully. Loading the System Admin workspace...");
      setIsSubmitting(false);

      startTransition(() => {
        window.scrollTo({ top: 0, behavior: "instant" });
        router.refresh();
      });
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, "Unable to open the internal workspace."));
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/10 bg-primary/5 text-primary">
          <LockKeyhole className="h-5 w-5" />
        </div>
        <CardTitle className="mt-4 text-2xl">System Administrator Sign In</CardTitle>
        <CardDescription>
          This workspace is exclusively for the System Administrator. Only the System Admin
          can create events, manage the platform lifecycle, and access the global dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-[1.2rem] border border-primary/15 bg-primary/5 px-5 py-5 text-left">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <UserCog className="h-4 w-4 text-primary" />
            System Admin
          </div>
          <div className="mt-3 text-sm leading-6 text-muted-foreground">
            Full platform access — create events, assign teams, manage users, audit logs, and global financial oversight.
          </div>
        </div>

        <div className="rounded-[1.15rem] border border-info/15 bg-info/5 px-4 py-4 text-sm leading-6 text-muted-foreground">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <Users className="h-4 w-4 text-info" />
            Event team members
          </div>
          <div className="mt-2">
            Event team members (Event Admin, Finance Controller, Approver, Event Manager) should
            sign in through the <strong className="text-foreground">Event Team Sign In</strong> button
            on their specific event&apos;s public page. Each event has its own dedicated team workspace.
          </div>
        </div>

        <div className="rounded-[1.15rem] border border-success/15 bg-success-muted px-4 py-4 text-sm leading-6 text-muted-foreground">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <ShieldCheck className="h-4 w-4 text-success" />
            Architecture note
          </div>
          <div className="mt-2">
            After the System Admin creates and publishes an event, all event-related controls
            are handled by the event&apos;s assigned team through their scoped workspace.
            The System Admin retains global oversight across all events.
          </div>
        </div>

        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <Field
            className="md:col-span-2"
            label="Administrator email"
            description="Enter the System Admin email credentials."
          >
            <Input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => {
                setErrorMessage(null);
                setSuccessMessage(null);
                setEmail(event.target.value);
              }}
              required
            />
          </Field>
          <Field
            className="md:col-span-2"
            label="Password"
            description="Use the System Admin password configured in the backend."
          >
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => {
                setErrorMessage(null);
                setSuccessMessage(null);
                setPassword(event.target.value);
              }}
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
            <Button type="submit" disabled={isBusy}>
              {isBusy ? "Opening workspace..." : "Sign in as System Admin"}
            </Button>
            <span className="text-sm text-muted-foreground">
              Role access is enforced again by the backend after sign-in.
            </span>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
