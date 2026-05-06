"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, ShieldAlert, CheckCircle } from "lucide-react";

import { getApiErrorMessage } from "@/lib/api/shared";
import { postJson } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!token) {
    return (
      <div className="flex min-h-[calc(100vh-140px)] items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-destructive/10 bg-destructive/5 text-destructive">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <CardTitle className="mt-3 text-xl">Invalid reset link</CardTitle>
            <CardDescription>
              This password reset link is invalid or missing the secure token. Please request a new link from the sign-in page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/dashboard")} className="w-full">
              Return to sign in
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (successMessage) {
    return (
      <div className="flex min-h-[calc(100vh-140px)] items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-success/10 bg-success-muted text-success">
              <CheckCircle className="h-5 w-5" />
            </div>
            <CardTitle className="mt-3 text-xl">Password reset successfully</CardTitle>
            <CardDescription>{successMessage}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/dashboard")} className="w-full">
              Go to sign in
            </Button>
          </CardContent>
        </Card>
      </div>
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
    <div className="flex min-h-[calc(100vh-140px)] items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/10 bg-primary/5 text-primary">
            <KeyRound className="h-5 w-5" />
          </div>
          <CardTitle className="mt-3 text-2xl">Set new password</CardTitle>
          <CardDescription>Enter a new secure password for your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="New password" description="Use at least 8 characters." error={errorMessage && newPassword.length < 8 ? errorMessage : undefined}>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => {
                  setErrorMessage(null);
                  setNewPassword(e.target.value);
                }}
                placeholder="Enter new password"
                minLength={8}
                required
                autoFocus
              />
            </Field>

            {errorMessage && newPassword.length >= 8 && (
              <div className="rounded-[1rem] border border-destructive/15 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {errorMessage}
              </div>
            )}

            <div className="pt-2 flex flex-col gap-3">
              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? "Saving..." : "Save new password"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push("/dashboard")} className="w-full" disabled={isSubmitting}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <React.Suspense fallback={<div className="flex min-h-[calc(100vh-140px)] items-center justify-center">Loading...</div>}>
      <ResetPasswordContent />
    </React.Suspense>
  );
}
