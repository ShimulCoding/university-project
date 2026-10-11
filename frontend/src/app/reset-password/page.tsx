"use client";

import React, { useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, ShieldAlert, CheckCircle } from "lucide-react";

import { getApiErrorMessage } from "@/lib/api/shared";
import { postJson } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { PublicPageShell } from "@/components/shell/public-page-shell";
import { PasswordInput } from "@/components/ui/password-input";
import { resolveResetToken } from "@/lib/reset-token";

function subscribeFragment(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  window.addEventListener("popstate", onChange);
  return () => {
    window.removeEventListener("hashchange", onChange);
    window.removeEventListener("popstate", onChange);
  };
}
const browserFragment = () => window.location.hash;
const serverFragment = () => undefined;

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fragment = useSyncExternalStore(subscribeFragment, browserFragment, serverFragment);
  const token = resolveResetToken(fragment, searchParams.get("token"));

  if (token === undefined) {
    return (
      <main id="main-content" tabIndex={-1} className="flex min-h-[65vh] items-center justify-center px-4 py-12">
        <Card className="max-w-md w-full">
          <CardHeader>
            <h1 className="font-display text-3xl font-normal">Checking reset link</h1>
            <CardDescription role="status">Preparing your password reset form...</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  if (!token) {
    return (
      <main id="main-content" tabIndex={-1} className="flex min-h-[65vh] items-center justify-center px-4 py-12">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div role="alert" className="flex h-11 w-11 items-center justify-center rounded-2xl border border-destructive/10 bg-destructive/5 text-destructive">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <h1 className="mt-3 font-display text-3xl font-normal">Invalid reset link</h1>
            <CardDescription>
              This password reset link is invalid or missing the secure token. Please request a new link from the sign-in page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/complaints")} className="w-full">
              Return to sign in
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return <ResetPasswordForm key={token} token={token} />;
}

function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (successMessage) {
    return (
      <main id="main-content" tabIndex={-1} className="flex min-h-[65vh] items-center justify-center px-4 py-12">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div role="status" className="flex h-11 w-11 items-center justify-center rounded-2xl border border-success/10 bg-success-muted text-success">
              <CheckCircle className="h-5 w-5" />
            </div>
            <h1 className="mt-3 font-display text-3xl font-normal">Password reset successfully</h1>
            <CardDescription>{successMessage}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/complaints")} className="w-full">
              Go to sign in
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (newPassword.length < 8) {
      setErrorMessage("New password must be at least 8 characters.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const result = await postJson<{ message: string }>("/auth/reset-password", {
        token,
        newPassword,
      });

      setSuccessMessage(result.message);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, "Failed to reset password. The link may have expired or already been used."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main id="main-content" tabIndex={-1} className="flex min-h-[65vh] items-center justify-center px-4 py-12">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/10 bg-primary/5 text-primary">
            <KeyRound className="h-5 w-5" />
          </div>
          <h1 className="mt-3 font-display text-3xl font-normal">Set new password</h1>
          <CardDescription>Enter a new secure password for your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="New password" description="Use at least 8 characters." error={errorMessage && newPassword.length < 8 ? errorMessage : undefined}>
              <PasswordInput

                value={newPassword}
                onChange={(e) => {
                  setErrorMessage(null);
                  setNewPassword(e.target.value);
                }}
                placeholder="Enter new password"
                minLength={8}
                required
                autoComplete="new-password"
              />
            </Field>

            {errorMessage && newPassword.length >= 8 && (
              <div role="alert" className="rounded-[1rem] border border-destructive/15 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {errorMessage}
              </div>
            )}

            <div className="pt-2 flex flex-col gap-3">
              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? "Saving..." : "Save new password"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push("/complaints")} className="w-full" disabled={isSubmitting}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <PublicPageShell><React.Suspense fallback={<div className="flex min-h-[calc(100vh-140px)] items-center justify-center">Loading...</div>}>
      <ResetPasswordContent />
    </React.Suspense></PublicPageShell>
  );
}
