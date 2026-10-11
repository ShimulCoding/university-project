"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";

import { getApiErrorMessage } from "@/lib/api/shared";
import { postJson } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { MfaAccessPanel, type PasswordLoginResponse } from "@/components/auth/mfa-access-panel";

export function InternalAccessPanel() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaMode, setMfaMode] = useState<"ENROLL" | "VERIFY" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [routingPending, startTransition] = useTransition();
  const isBusy = isSubmitting || routingPending;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      const result = await postJson<PasswordLoginResponse>("/auth/internal-login", {
        email: email.trim(),
        password,
      });
      setPassword("");
      if ("mfaRequired" in result) { setMfaMode(result.mode); setIsSubmitting(false); return; }

      setSuccessMessage(
        "Signed in successfully. Loading the System Admin workspace...",
      );
      setIsSubmitting(false);

      startTransition(() => {
        window.scrollTo({ top: 0, behavior: "instant" });
        router.refresh();
      });
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, "Unable to open the internal workspace."),
      );
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="border-0 p-0 shadow-none sm:p-0">
      <CardHeader>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/10 bg-primary/5 text-primary">
          <LockKeyhole className="h-5 w-5" />
        </div>
        <CardTitle className="mt-4 text-2xl">
          System Administrator Sign In
        </CardTitle>
        <CardDescription>
          Use your administrator account to manage the platform.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {mfaMode ? <MfaAccessPanel mode={mfaMode} onComplete={() => startTransition(() => router.refresh())} onCancel={() => setMfaMode(null)} /> : <>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <Field className="md:col-span-2" label="Administrator email">
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
          <Field className="md:col-span-2" label="Password">
            <PasswordInput
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
            <div
              role="alert"
              className="md:col-span-2 rounded-[1rem] border border-destructive/15 bg-destructive/5 px-4 py-3 text-sm text-destructive"
            >
              {errorMessage}
            </div>
          ) : null}
          {successMessage ? (
            <div
              role="status"
              className="md:col-span-2 rounded-[1rem] border border-success/15 bg-success-muted px-4 py-3 text-sm text-success"
            >
              {successMessage}
            </div>
          ) : null}
          <div className="md:col-span-2 flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={isBusy} className="w-full">
              {isBusy ? "Opening workspace..." : "Sign in as System Admin"}
            </Button>
          </div>
        </form>
        </>}
        <div className="border-t border-border pt-5 text-xs leading-6 text-muted-foreground">
          Part of an event team?{" "}
          <Link
            href="/events"
            className="focus-ring rounded font-semibold text-success"
          >
            Find your event
          </Link>{" "}
          and use its Event Team Sign In.
        </div>
      </CardContent>
    </Card>
  );
}
