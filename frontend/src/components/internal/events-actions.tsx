"use client";

import { useState } from "react";

import type { AppRole, EventStatus, ManagedEvent } from "@/types";
import { apiFetchClient, patchJson, postJson } from "@/lib/api/client";
import { formatEnumLabel } from "@/lib/format";
import { FeedbackMessage, useActionState } from "@/components/internal/action-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const eventStatusOptions: Array<{ value: EventStatus; label: string }> = [
  { value: "DRAFT", label: "Draft" },
  { value: "PUBLISHED", label: "Published" },
];

const eventTransitions: Record<EventStatus, EventStatus[]> = {
  DRAFT: ["PUBLISHED", "ARCHIVED"],
  PUBLISHED: ["REGISTRATION_CLOSED", "IN_PROGRESS", "COMPLETED", "ARCHIVED"],
  REGISTRATION_CLOSED: ["IN_PROGRESS", "COMPLETED", "ARCHIVED"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED: ["CLOSED"],
  CLOSED: ["ARCHIVED"],
  ARCHIVED: [],
};

type RequiredEventTeamRole = Extract<
  AppRole,
  "EVENT_ADMIN" | "EVENT_MANAGEMENT_USER" | "FINANCIAL_CONTROLLER" | "ORGANIZATIONAL_APPROVER"
>;

const requiredEventTeamRoles: Array<{ roleCode: RequiredEventTeamRole; label: string }> = [
  { roleCode: "EVENT_ADMIN", label: "Event Admin" },
  { roleCode: "EVENT_MANAGEMENT_USER", label: "Event Manager" },
  { roleCode: "FINANCIAL_CONTROLLER", label: "Finance Controller" },
  { roleCode: "ORGANIZATIONAL_APPROVER", label: "Approver" },
];

type AssignableEventTeamRole = Extract<
  AppRole,
  RequiredEventTeamRole | "COMPLAINT_REVIEW_AUTHORITY"
>;

const assignableEventTeamRoles: Array<{
  roleCode: AssignableEventTeamRole;
  label: string;
}> = [
  ...requiredEventTeamRoles,
  { roleCode: "COMPLAINT_REVIEW_AUTHORITY", label: "Complaint Reviewer" },
];

type TeamMemberDraft = {
  fullName: string;
  email: string;
  password: string;
};

function createEmptyTeamDrafts() {
  return requiredEventTeamRoles.reduce(
    (drafts, role) => ({
      ...drafts,
      [role.roleCode]: {
        fullName: "",
        email: "",
        password: "",
      },
    }),
    {} as Record<RequiredEventTeamRole, TeamMemberDraft>,
  );
}

function optionalDateTime(value: string) {
  return value ? new Date(value).toISOString() : undefined;
}

export function EventCreateForm() {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<EventStatus>("DRAFT");
  const [capacity, setCapacity] = useState("");
  const [registrationOpensAt, setRegistrationOpensAt] = useState("");
  const [registrationClosesAt, setRegistrationClosesAt] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [teamMembers, setTeamMembers] = useState(createEmptyTeamDrafts);
  const { feedback, isPending, clearFeedback, runAction } = useActionState();
  const teamIsComplete = requiredEventTeamRoles.every((role) => {
    const draft = teamMembers[role.roleCode];
    return draft.email.trim().length > 0;
  });

  const updateTeamMember = (
    roleCode: RequiredEventTeamRole,
    field: keyof TeamMemberDraft,
    value: string,
  ) => {
    clearFeedback();
    setTeamMembers((current) => ({
      ...current,
      [roleCode]: {
        ...current[roleCode],
        [field]: value,
      },
    }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Create event</CardTitle>
        <CardDescription>
          Only the System Admin can create events. Each event must start with its own assigned
          Event Admin, Event Manager, Finance Controller, and Approver.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Event title">
            <Input
              value={title}
              onChange={(event) => {
                clearFeedback();
                setTitle(event.target.value);
              }}
              placeholder="CSE Tech Fest 2026"
              required
            />
          </Field>
          <Field label="Optional slug">
            <Input
              value={slug}
              onChange={(event) => {
                clearFeedback();
                setSlug(event.target.value);
              }}
              placeholder="cse-tech-fest-2026"
            />
          </Field>
        </div>
        <Field label="Description">
          <Textarea
            rows={4}
            value={description}
            onChange={(event) => {
              clearFeedback();
              setDescription(event.target.value);
            }}
            placeholder="Describe the event purpose, audience, and public registration context."
          />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Initial status">
            <Select
              value={status}
              onChange={(event) => {
                clearFeedback();
                setStatus(event.target.value as EventStatus);
              }}
              options={eventStatusOptions}
            />
          </Field>
          <Field label="Capacity">
            <Input
              type="number"
              min="1"
              value={capacity}
              onChange={(event) => {
                clearFeedback();
                setCapacity(event.target.value);
              }}
              placeholder="Optional seat limit"
            />
          </Field>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Registration opens">
            <Input
              type="datetime-local"
              value={registrationOpensAt}
              onChange={(event) => {
                clearFeedback();
                setRegistrationOpensAt(event.target.value);
              }}
            />
          </Field>
          <Field label="Registration closes">
            <Input
              type="datetime-local"
              value={registrationClosesAt}
              onChange={(event) => {
                clearFeedback();
                setRegistrationClosesAt(event.target.value);
              }}
            />
          </Field>
          <Field label="Event starts">
            <Input
              type="datetime-local"
              value={startsAt}
              onChange={(event) => {
                clearFeedback();
                setStartsAt(event.target.value);
              }}
            />
          </Field>
          <Field label="Event ends">
            <Input
              type="datetime-local"
              value={endsAt}
              onChange={(event) => {
                clearFeedback();
                setEndsAt(event.target.value);
              }}
            />
          </Field>
        </div>
        <div className="space-y-4 rounded-[1rem] border border-border/70 bg-panel-muted p-4">
          <div>
            <div className="text-sm font-semibold text-foreground">Required event team</div>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Use separate email accounts for the four required roles. A password is required
              only when the email does not already belong to an internal account.
            </p>
          </div>
          <div className="grid gap-4">
            {requiredEventTeamRoles.map((role) => {
              const draft = teamMembers[role.roleCode];

              return (
                <div key={role.roleCode} className="grid gap-3 md:grid-cols-3">
                  <Field label={`${role.label} name`}>
                    <Input
                      value={draft.fullName}
                      onChange={(event) =>
                        updateTeamMember(role.roleCode, "fullName", event.target.value)
                      }
                      placeholder={role.label}
                    />
                  </Field>
                  <Field label={`${role.label} email`}>
                    <Input
                      type="email"
                      value={draft.email}
                      onChange={(event) =>
                        updateTeamMember(role.roleCode, "email", event.target.value)
                      }
                      placeholder="name@gmail.com"
                      required
                    />
                  </Field>
                  <Field label={`${role.label} password (new account only)`}>
                    <Input
                      type="password"
                      value={draft.password}
                      onChange={(event) =>
                        updateTeamMember(role.roleCode, "password", event.target.value)
                      }
                      placeholder="Leave blank for an existing account"
                    />
                  </Field>
                </div>
              );
            })}
          </div>
        </div>
        <FeedbackMessage feedback={feedback} />
        <Button
          disabled={isPending || title.trim().length < 3 || !teamIsComplete}
          onClick={() =>
            void runAction(
              async () => {
                await postJson("/events", {
                  title: title.trim(),
                  slug: slug.trim() || undefined,
                  description: description.trim() || undefined,
                  status,
                  capacity: capacity ? Number(capacity) : undefined,
                  registrationOpensAt: optionalDateTime(registrationOpensAt),
                  registrationClosesAt: optionalDateTime(registrationClosesAt),
                  startsAt: optionalDateTime(startsAt),
                  endsAt: optionalDateTime(endsAt),
                  teamMembers: requiredEventTeamRoles.map((role) => ({
                    roleCode: role.roleCode,
                    fullName: teamMembers[role.roleCode].fullName.trim() || undefined,
                    email: teamMembers[role.roleCode].email.trim(),
                    password: teamMembers[role.roleCode].password || undefined,
                  })),
                });
                setTitle("");
                setSlug("");
                setDescription("");
                setStatus("DRAFT");
                setCapacity("");
                setRegistrationOpensAt("");
                setRegistrationClosesAt("");
                setStartsAt("");
                setEndsAt("");
                setTeamMembers(createEmptyTeamDrafts());
              },
              status === "PUBLISHED"
                ? "Event created with its assigned team and published for public registration."
                : "Event draft created with its assigned team.",
            )
          }
        >
          {isPending ? "Creating event..." : "Create event"}
        </Button>
      </CardContent>
    </Card>
  );
}

export function EventStatusControl({
  event,
  allowedStatuses,
}: {
  event: ManagedEvent;
  allowedStatuses?: EventStatus[];
}) {
  const transitions = eventTransitions[event.status].filter(
    (status) => !allowedStatuses || allowedStatuses.includes(status),
  );
  const options = transitions.map((status) => ({
    value: status,
    label: formatEnumLabel(status),
  }));
  const [nextStatus, setNextStatus] = useState<EventStatus | "">(options[0]?.value ?? "");
  const { feedback, isPending, clearFeedback, runAction } = useActionState();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Lifecycle control</CardTitle>
        <CardDescription>
          Move this event through launch, completion, and closure without bypassing the backend
          transition rules.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {options.length > 0 ? (
          <>
            <Field label="Next status">
              <Select
                value={nextStatus}
                onChange={(event) => {
                  clearFeedback();
                  setNextStatus(event.target.value as EventStatus);
                }}
                options={options}
              />
            </Field>
            <FeedbackMessage feedback={feedback} />
            <Button
              disabled={isPending || !nextStatus}
              onClick={() =>
                void runAction(
                  () => patchJson(`/events/${event.slug}`, { status: nextStatus }),
                  "Event status updated.",
                )
              }
            >
              {isPending ? "Updating event..." : "Update event status"}
            </Button>
          </>
        ) : (
          <div className="rounded-[1rem] border border-border/70 bg-panel-muted px-4 py-4 text-sm leading-6 text-muted-foreground">
            This event has no further lifecycle transition available from its current status.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function EventTeamManagement({ event }: { event: ManagedEvent }) {
  const [roleCode, setRoleCode] = useState<AssignableEventTeamRole>("EVENT_ADMIN");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { feedback, isPending, clearFeedback, runAction } = useActionState();
  const requiredRoleCodes = new Set(requiredEventTeamRoles.map((role) => role.roleCode));
  const roleCounts = event.teamMembers.reduce<Record<string, number>>((counts, member) => {
    counts[member.roleCode] = (counts[member.roleCode] ?? 0) + 1;
    return counts;
  }, {});
  const canAssign =
    email.trim().length > 0 && (password.length === 0 || password.length >= 8);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Event team assignments</CardTitle>
        <CardDescription>
          Assign personnel only to this event. Existing accounts can be reused across events by
          email; provide a temporary password only when creating a new account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 pt-0">
        <div className="space-y-3">
          {event.teamMembers.map((member) => {
            const isOnlyRequiredMember =
              requiredRoleCodes.has(member.roleCode as RequiredEventTeamRole) &&
              roleCounts[member.roleCode] === 1;

            return (
              <div
                key={member.id}
                className="flex flex-col gap-3 rounded-[1rem] border border-border/70 bg-panel-muted px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="font-semibold text-foreground">{member.user.fullName}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{member.user.email}</div>
                  <div className="mt-1 text-xs font-medium uppercase tracking-wider text-primary">
                    {formatEnumLabel(member.roleCode)}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  disabled={isPending || isOnlyRequiredMember}
                  title={
                    isOnlyRequiredMember
                      ? "Assign a replacement for this required role before revoking it."
                      : "Revoke this event assignment"
                  }
                  onClick={() =>
                    void runAction(
                      () =>
                        apiFetchClient<void>(
                          `/events/${event.slug}/team-members/${member.id}`,
                          { method: "DELETE" },
                        ),
                      "Event team assignment revoked.",
                    )
                  }
                >
                  Revoke assignment
                </Button>
              </div>
            );
          })}
        </div>

        <div className="grid gap-4 rounded-[1rem] border border-border/70 bg-panel p-4 md:grid-cols-2">
          <Field label="Event role">
            <Select
              value={roleCode}
              onChange={(event) => {
                clearFeedback();
                setRoleCode(event.target.value as AssignableEventTeamRole);
              }}
              options={assignableEventTeamRoles.map((role) => ({
                value: role.roleCode,
                label: role.label,
              }))}
            />
          </Field>
          <Field label="Assigned email">
            <Input
              type="email"
              value={email}
              onChange={(event) => {
                clearFeedback();
                setEmail(event.target.value);
              }}
              placeholder="team.member@example.com"
              required
            />
          </Field>
          <Field label="Name (new account only)">
            <Input
              value={fullName}
              onChange={(event) => {
                clearFeedback();
                setFullName(event.target.value);
              }}
              placeholder="Event team member"
            />
          </Field>
          <Field label="Password (new account only)">
            <Input
              type="password"
              value={password}
              onChange={(event) => {
                clearFeedback();
                setPassword(event.target.value);
              }}
              placeholder="Leave blank for an existing account"
            />
          </Field>
        </div>
        <FeedbackMessage feedback={feedback} />
        <Button
          type="button"
          disabled={isPending || !canAssign}
          onClick={() =>
            void runAction(
              async () => {
                await postJson(`/events/${event.slug}/team-members`, {
                  roleCode,
                  email: email.trim(),
                  fullName: fullName.trim() || undefined,
                  password: password || undefined,
                });
                setFullName("");
                setEmail("");
                setPassword("");
              },
              "Event team assignment saved.",
            )
          }
        >
          {isPending ? "Saving assignment..." : "Assign to this event"}
        </Button>
      </CardContent>
    </Card>
  );
}
