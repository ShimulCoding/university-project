"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, ShieldCheck, UserCog } from "lucide-react";

import { getApiErrorMessage } from "@/lib/api/shared";
import { postJson } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const demoAccounts = [
  {
    label: "Finance demo",
    email: "demo.finance@example.com",
    description: "Payment verification, income records, and reconciliation.",
  },
  {
    label: "Approver demo",
    email: "demo.approver@example.com",
    description: "Approval queue, complaint routing, and publish decisions.",
  },
  {
    label: "Event demo",
    email: "demo.event.manager@example.com",
    description: "Budget and expense request authoring surfaces.",
  },
] as const;

export function InternalAccessPanel() {
  const router = useRouter();
  const [email, setEmail] = useState<string>(demoAccounts[0].email);
  const [password, setPassword] = useState("DemoPass123!");
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
      await postJson("/auth/login", {
        email: email.trim(),
        password,
      });

      setSuccessMessage("Signed in successfully. Loading the internal workspace...");
      setIsSubmitting(false);

      startTransition(() => {
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
        <CardTitle className="mt-4 text-2xl">Sign in to the protected workspace</CardTitle>
        <CardDescription>
          Internal routes are backed by the live backend and only open for authenticated
          internal roles. The seeded demo accounts below are available for local review.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 md:grid-cols-3">
          {demoAccounts.map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => {
                setErrorMessage(null);
                setSuccessMessage(null);
                setEmail(account.email);
                setPassword("DemoPass123!");
              }}
              className="rounded-[1.2rem] border border-border/70 bg-panel-muted px-4 py-4 text-left transition-colors hover:border-primary/15 hover:bg-panel"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <UserCog className="h-4 w-4 text-primary" />
                {account.label}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">{account.email}</div>
              <div className="mt-3 text-sm leading-6 text-muted-foreground">
                {account.description}
              </div>
            </button>
          ))}
        </div>

        <div className="rounded-[1.15rem] border border-success/15 bg-success-muted px-4 py-4 text-sm leading-6 text-muted-foreground">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <ShieldCheck className="h-4 w-4 text-success" />
            Demo access hint
          </div>
          <div className="mt-2">
            The seeded internal demo accounts use the shared local password{" "}
            <span className="font-semibold text-foreground">DemoPass123!</span>.
          </div>
        </div>

        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <Field
            className="md:col-span-2"
            label="Internal account email"
            description="Choose one of the seeded demo identities or enter another internal account."
          >
            <Input
              type="email"
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
            description="Use the internal account password configured in the live backend."
          >
            <Input
              type="password"
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
              {isBusy ? "Opening workspace..." : "Open internal workspace"}
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
