"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, UserRoundPlus } from "lucide-react";

import { ApiError } from "@/lib/api/shared";
import { postJson } from "@/lib/api/client";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type StudentAccessPanelProps = {
  title: string;
  description: string;
};

export function StudentAccessPanel({
  title,
  description,
}: StudentAccessPanelProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("register");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const options = useMemo(
    () => [
      { value: "register", label: "Create access", meta: "New student account" },
      { value: "login", label: "Sign in", meta: "Existing student session" },
    ],
    [],
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setErrorMessage(null);

      if (mode === "register") {
        await postJson("/auth/register", {
          fullName,
          email,
          password,
        });
      } else {
        await postJson("/auth/login", {
          email,
          password,
        });
      }

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError ? error.message : "Unable to start the student session.",
      );
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/10 bg-primary/5 text-primary">
          {mode === "register" ? (
            <UserRoundPlus className="h-5 w-5" />
          ) : (
            <ShieldCheck className="h-5 w-5" />
          )}
        </div>
        <Badge variant="info" className="mt-4 w-fit">
          Student-owned access only
        </Badge>
        <CardTitle className="mt-3 text-2xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <SegmentedControl
          value={mode}
          onValueChange={(value) => setMode(value as "login" | "register")}
          options={options}
        />
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          {mode === "register" ? (
            <Field
              className="md:col-span-2"
              label="Full name"
              description="This becomes the student-owned profile name for registrations and complaints."
            >
              <Input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Enter your full name"
                required
              />
            </Field>
          ) : null}
          <Field
            className={mode === "register" ? "" : "md:col-span-2"}
            label="Email"
            description="Your backend session is attached to this email."
          >
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="student@example.com"
              required
            />
          </Field>
          <Field
            className={mode === "register" ? "" : "md:col-span-2"}
            label="Password"
            description="Use at least 8 characters."
          >
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Create a secure password"
              minLength={8}
              required
            />
          </Field>
          {errorMessage ? (
            <div className="md:col-span-2 rounded-[1rem] border border-destructive/15 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {errorMessage}
            </div>
          ) : null}
          <div className="md:col-span-2 flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={isPending}>
              {isPending
                ? mode === "register"
                  ? "Creating access..."
                  : "Signing in..."
                : mode === "register"
                  ? "Create student access"
                  : "Sign in"}
            </Button>
            <p className="text-sm leading-6 text-muted-foreground">
              Public event and summary pages remain accessible without signing in.
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
