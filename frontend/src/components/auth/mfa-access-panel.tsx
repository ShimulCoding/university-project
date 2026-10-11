"use client";

import { useState } from "react";
import type { UserProfile } from "@/types";
import { postEmpty, postJson } from "@/lib/api/client";
import { getApiErrorMessage } from "@/lib/api/shared";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export type PasswordLoginResponse = { user: UserProfile } | { mfaRequired: true; mode: "ENROLL" | "VERIFY" };

export function MfaAccessPanel({ mode, onComplete, onCancel }: { mode: "ENROLL" | "VERIFY"; onComplete: () => void; onCancel: () => void }) {
  const [enrollmentCode, setEnrollmentCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needsSetup = mode === "ENROLL" && !secret;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(null);
    try {
      if (needsSetup) {
        const result = await postJson<{ secret: string }>("/auth/mfa/start-enrollment", { enrollmentCode: enrollmentCode.trim() });
        setEnrollmentCode(""); setSecret(result.secret);
      } else {
        const result = await postJson<{ recoveryCodes?: string[] }>("/auth/mfa/verify", { code: code.trim() });
        setSecret(""); setCode("");
        if (result.recoveryCodes) setRecoveryCodes(result.recoveryCodes); else onComplete();
      }
    } catch (cause) { setError(getApiErrorMessage(cause, "Unable to verify this sign-in.")); }
    finally { setBusy(false); }
  }

  if (recoveryCodes) return <div className="space-y-4">
    <h3 className="font-display text-xl">Save your recovery codes</h3>
    <p className="text-sm text-muted-foreground">Each code works once if your authenticator is unavailable. Store these privately offline. They will not be shown again.</p>
    <ul className="grid gap-2 rounded-xl border border-border bg-panel-muted p-4 text-xs sm:grid-cols-2" aria-label="One-use recovery codes">
      {recoveryCodes.map((value) => <li key={value}><code className="break-all font-mono">{value}</code></li>)}
    </ul>
    <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={saved} onChange={(event) => setSaved(event.target.checked)} />I stored these codes safely.</label>
    <Button disabled={!saved} onClick={onComplete}>Continue to workspace</Button>
  </div>;

  return <form onSubmit={submit} className="space-y-4" aria-label="Multifactor sign-in">
    <div><h3 className="font-display text-xl">{mode === "ENROLL" ? "Set up your authenticator" : "Verify your sign-in"}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{needsSetup ? "Ask your System Admin for a one-use setup code after they confirm your identity. Your password alone cannot enable operational access." : "Use your authenticator code. Verification expires five minutes after password sign-in."}</p>
    </div>
    {needsSetup ? <Field label="Enrollment authorization code"><Input autoComplete="off" value={enrollmentCode} onChange={(event) => setEnrollmentCode(event.target.value)} maxLength={64} minLength={64} required /></Field> : <>
      {secret ? <Field label="Authenticator setup key" description="Add a time-based account in your authenticator, named MU CSE Transparency. Enter this key, then verify its six-digit code. Keep this key private."><Input value={secret} readOnly autoComplete="off" className="font-mono" /></Field> : null}
      <Field label={mode === "ENROLL" ? "Authenticator code" : "Authenticator or recovery code"}><Input value={code} onChange={(event) => setCode(event.target.value)} autoComplete="one-time-code" maxLength={80} minLength={6} required /></Field>
    </>}
    {error ? <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</p> : null}
    <div className="flex flex-wrap gap-3"><Button type="submit" disabled={busy}>{busy ? "Verifying..." : needsSetup ? "Authorize setup" : "Verify sign-in"}</Button>
      <Button type="button" variant="outline" disabled={busy} onClick={async () => { setBusy(true); try { await postEmpty("/auth/logout"); onCancel(); } catch (cause) { setError(getApiErrorMessage(cause, "Unable to cancel sign-in.")); } finally { setBusy(false); } }}>Start again</Button></div>
  </form>;
}
