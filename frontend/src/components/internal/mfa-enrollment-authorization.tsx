"use client";

import { useState } from "react";
import { postJson } from "@/lib/api/client";
import { getApiErrorMessage } from "@/lib/api/shared";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";

export function MfaEnrollmentAuthorization({ userId }: { userId: string }) {
  const [password, setPassword] = useState(""); const [confirmed, setConfirmed] = useState(false);
  const [grant, setGrant] = useState<{ code: string; expiresAt: string } | null>(null);
  const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  return <form className="space-y-3 rounded-xl border border-border p-4" onSubmit={async (event) => {
    event.preventDefault(); setBusy(true); setError(null);
    try { setGrant(await postJson("/auth/mfa/enrollment-grants", { userId, currentPassword: password, identityConfirmed: confirmed })); setPassword(""); }
    catch (cause) { setError(getApiErrorMessage(cause, "Unable to authorize enrollment.")); }
    finally { setBusy(false); }
  }}>
    <h3 className="font-semibold">Authorize authenticator setup</h3>
    <p className="text-sm text-muted-foreground">Confirm this person’s identity through a trusted channel first. Share the one-use code privately; it expires in 24 hours. A new code revokes previous unused authorizations.</p>
    <Field label="Your current administrator password"><PasswordInput value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></Field>
    <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} required />I verified this person’s identity.</label>
    <Button type="submit" disabled={!confirmed || busy}>{busy ? "Authorizing..." : "Issue one-use setup code"}</Button>
    {grant ? <Field label="One-use enrollment code" description={`Expires ${new Date(grant.expiresAt).toLocaleString()}. This is shown only here.`}><Input className="font-mono text-xs" value={grant.code} autoComplete="off" readOnly /></Field> : null}
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
  </form>;
}
