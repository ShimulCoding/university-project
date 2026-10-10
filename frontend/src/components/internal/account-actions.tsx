"use client";

import { useState } from "react";
import type { AccountStatus, UserProfile } from "@/types";
import { apiFetchClient, patchJson, postJson } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FeedbackMessage, useActionState } from "@/components/internal/action-utils";

export type GlobalRoleAssignment = { id: string; roleCode: string; roleName: string };

export function AccountActions({ user, assignments }: { user: UserProfile; assignments: GlobalRoleAssignment[] }) {
  const [status, setStatus] = useState(user.status);
  const [roleCode, setRoleCode] = useState("GENERAL_STUDENT");
  const { feedback, isPending, runAction } = useActionState();
  return (
    <div className="space-y-5">
      <form className="grid gap-3" onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        void runAction(() => patchJson(`/users/${user.id}/profile`, { fullName: data.get("fullName"), studentId: data.get("studentId")?.toString().trim() || undefined }), "Account profile updated.");
      }}>
        <Field label="Full name"><Input name="fullName" defaultValue={user.fullName} minLength={2} maxLength={100} required /></Field>
        <Field label="Student ID" description="Required for student sign-in and event registration. Leave blank for an event team or System Admin account.">
          <Input name="studentId" defaultValue={user.studentId ?? ""} minLength={3} maxLength={30} />
        </Field>
        <Button type="submit" disabled={isPending}>Save account profile</Button>
      </form>
      <Field label="Account status" description="Assign an active replacement in every affected event before deactivating a required team member.">
        <Select value={status} onChange={(event) => setStatus(event.target.value as AccountStatus)} options={["ACTIVE", "INACTIVE", "SUSPENDED"].map((value) => ({ value, label: value }))} />
      </Field>
      <Button disabled={isPending || status === user.status} onClick={() => void runAction(() => patchJson(`/users/${user.id}/status`, { status }), "Account status updated.")}>Update account status</Button>
      <Field label="Global role" description="Event roles belong to event teams. System Admin accounts must have no active event assignments.">
        <Select value={roleCode} onChange={(event) => setRoleCode(event.target.value)} options={[{ value: "GENERAL_STUDENT", label: "Student" }, { value: "SYSTEM_ADMIN", label: "System Admin" }]} />
      </Field>
      <Button disabled={isPending || assignments.some((assignment) => assignment.roleCode === roleCode) || (roleCode === "SYSTEM_ADMIN" && user.eventRoles.length > 0)} onClick={() => void runAction(() => postJson("/roles/assignments", { userId: user.id, roleCode }), "Global role assigned.")}>Assign global role</Button>
      <div className="space-y-2">{assignments.map((assignment) => (
        <div key={assignment.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
          <span className="text-sm">{assignment.roleName}</span>
          <Button size="sm" variant="danger" disabled={isPending} onClick={() => void runAction(() => apiFetchClient(`/roles/assignments/${assignment.id}`, { method: "DELETE" }), "Global role revoked.")}>Revoke</Button>
        </div>
      ))}</div>
      <FeedbackMessage feedback={feedback} />
    </div>
  );
}

export function AccountCreateForm() {
  const [roleCode, setRoleCode] = useState("NONE");
  const { feedback, isPending, runAction } = useActionState();
  return (
    <form className="space-y-4" onSubmit={(event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = new FormData(form);
      void runAction(async () => {
        await postJson("/users", { fullName: data.get("fullName"), email: data.get("email"), password: data.get("password"), studentId: data.get("studentId")?.toString().trim() || undefined, roleCodes: roleCode === "NONE" ? [] : [roleCode] });
        form.reset();
      }, "Account created. Assign event roles from Events and teams.");
    }}>
      <Field label="Full name"><Input name="fullName" minLength={2} maxLength={100} required /></Field>
      <Field label="Email"><Input name="email" type="email" required /></Field>
      <Field label="Initial password"><Input name="password" type="password" minLength={8} maxLength={72} autoComplete="new-password" required /></Field>
      <Field label="Account access"><Select name="roleCode" value={roleCode} onChange={(event) => setRoleCode(event.target.value)} options={[{ value: "NONE", label: "Event team account (assign through Events and teams)" }, { value: "GENERAL_STUDENT", label: "Student" }, { value: "SYSTEM_ADMIN", label: "System Admin" }]} /></Field>
      {roleCode === "GENERAL_STUDENT" ? <Field label="Student ID"><Input name="studentId" minLength={3} maxLength={30} required /></Field> : null}
      <FeedbackMessage feedback={feedback} />
      <Button type="submit" disabled={isPending}>{isPending ? "Creating account..." : "Create account"}</Button>
    </form>
  );
}
