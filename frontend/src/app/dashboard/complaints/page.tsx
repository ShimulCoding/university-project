import Link from "next/link";
import { AlertTriangle, SearchSlash, ShieldAlert } from "lucide-react";

import {
  getComplaint,
  listComplaintReviewQueue,
  listInternalEventOptions,
} from "@/lib/api/internal";
import { buildRelativeHref } from "@/lib/detail-query";
import { ApiError } from "@/lib/api/shared";
import { formatDateTime, formatEnumLabel, getComplaintStateTone } from "@/lib/format";
import { ComplaintWorkflowPanel } from "@/components/internal/complaints-actions";
import { ComplaintRoutingCard } from "@/components/internal/complaint-routing-card";
import { FilterCard } from "@/components/internal/filter-card";
import { SupportingDocumentList } from "@/components/internal/supporting-document-list";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { StatePanel } from "@/components/ui/state-panel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function ComplaintsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const eventId = typeof params.eventId === "string" ? params.eventId : undefined;
  const state = typeof params.state === "string" ? params.state : undefined;
  const search = typeof params.search === "string" ? params.search : undefined;
  const complaintId = typeof params.complaintId === "string" ? params.complaintId : undefined;

  try {
    const [complaints, events] = await Promise.all([
      listComplaintReviewQueue({ eventId, state, search }),
      listInternalEventOptions(),
    ]);
    const selectedComplaintId =
      complaints.find((item) => item.id === complaintId)?.id ?? complaints[0]?.id;
    const selectedComplaint = selectedComplaintId ? await getComplaint(selectedComplaintId) : null;

    return (
      <>
        <PageHeader
          eyebrow="Complaint review"
          title="Protect evidence, preserve routing history, and keep procedural steps explicit"
          description="Complaint review, routing, escalation, resolution, and closure stay inside the protected workspace. Public pages never expose this evidence or reviewer context."
          action={
            <div className="flex flex-wrap gap-2">
              <Badge variant="info">{complaints.length} visible complaints</Badge>
              <Badge variant="warning">Protected evidence</Badge>
            </div>
          }
        />

        <FilterCard resetHref="/dashboard/complaints">
          <Field label="Event">
            <Select
              name="eventId"
              defaultValue={eventId ?? ""}
              options={[
                { value: "", label: "All events" },
                ...events.map((event) => ({
                  value: event.id,
                  label: event.title,
                })),
              ]}
            />
          </Field>
          <Field label="State">
            <Select
              name="state"
              defaultValue={state ?? ""}
              options={[
                { value: "", label: "All states" },
                { value: "SUBMITTED", label: "Submitted" },
                { value: "UNDER_REVIEW", label: "Under review" },
                { value: "ROUTED", label: "Routed" },
                { value: "ESCALATED", label: "Escalated" },
                { value: "RESOLVED", label: "Resolved" },
                { value: "CLOSED", label: "Closed" },
              ]}
            />
          </Field>
          <Field label="Search">
            <Input
              name="search"
              defaultValue={search ?? ""}
              placeholder="Subject, student, or event"
            />
          </Field>
        </FilterCard>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_420px]">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Complaint review queue</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {complaints.length === 0 ? (
                <StatePanel
                  icon={SearchSlash}
                  title="No complaints are waiting in this view"
                  description="The complaint workflow is live, but the current demo data does not include an internal complaint queue item yet."
                  tone="empty"
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subject</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Submitter</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {complaints.map((complaint) => (
                      <TableRow
                        key={complaint.id}
                        data-state={complaint.id === selectedComplaintId ? "selected" : undefined}
                      >
                        <TableCell className="align-top">
                          <Link
                            href={buildRelativeHref("/dashboard/complaints", params, {
                              complaintId: complaint.id,
                            })}
                            className={
                              complaint.id === selectedComplaintId
                                ? "focus-ring rounded-sm font-semibold text-primary"
                                : "focus-ring rounded-sm font-semibold text-foreground hover:text-primary hover:underline"
                            }
                            aria-current={
                              complaint.id === selectedComplaintId ? "page" : undefined
                            }
                          >
                            {complaint.subject}
                          </Link>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {complaint.evidenceCount} protected evidence item(s)
                          </div>
                        </TableCell>
                        <TableCell>{complaint.event?.title ?? "General complaint"}</TableCell>
                        <TableCell>{complaint.submittedBy?.fullName ?? "Unknown submitter"}</TableCell>
                        <TableCell>
                          <Badge variant={getComplaintStateTone(complaint.state)}>
                            {formatEnumLabel(complaint.state)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            {selectedComplaint ? (
              <div key={selectedComplaint.id} className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl">Selected complaint</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-0">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={getComplaintStateTone(selectedComplaint.state)}>
                        {formatEnumLabel(selectedComplaint.state)}
                      </Badge>
                      <Badge variant="neutral">
                        {selectedComplaint.event?.title ?? "General complaint"}
                      </Badge>
                    </div>
                    <div className="rounded-[1rem] border border-border/70 bg-panel-muted px-4 py-4">
                      <div className="data-kicker">Subject</div>
                      <div className="mt-2 text-base font-semibold text-foreground">
                        {selectedComplaint.subject}
                      </div>
                      <div className="mt-2 text-sm leading-6 text-muted-foreground">
                        {selectedComplaint.description}
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-[1rem] border border-border/70 bg-panel px-4 py-4 text-sm leading-6 text-muted-foreground">
                        <div className="data-kicker">Submitted by</div>
                        <div className="mt-2 text-foreground">
                          {selectedComplaint.submittedBy?.fullName ?? "Unknown submitter"}
                        </div>
                        <div className="mt-1 text-muted-foreground">
                          {selectedComplaint.submittedBy?.email ?? "No email available"}
                        </div>
                      </div>
                      <div className="rounded-[1rem] border border-border/70 bg-panel px-4 py-4 text-sm leading-6 text-muted-foreground">
                        <div className="data-kicker">Created</div>
                        <div className="mt-2 text-foreground">
                          {formatDateTime(selectedComplaint.createdAt)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <SupportingDocumentList
                  documents={selectedComplaint.evidence}
                  title="Protected evidence metadata"
                  emptyMessage="No evidence file is attached to this complaint."
                />
                <ComplaintRoutingCard routingHistory={selectedComplaint.routingHistory} />
                <ComplaintWorkflowPanel complaintId={selectedComplaint.id} />
              </div>
            ) : (
              <Card tone="muted">
                <CardHeader>
                  <CardTitle className="text-xl">Protected workflow boundary</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
                  Complaint evidence, routing notes, and internal reviewer actions remain
                  protected even when the queue is empty.
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      return (
        <StatePanel
          icon={ShieldAlert}
          title="This account cannot review complaints"
          description="The live backend only allows system-admin, complaint-review, and organizational-approver roles into this workspace."
          tone="warning"
        />
      );
    }

    return (
      <StatePanel
        icon={AlertTriangle}
        title="Complaint review could not be loaded"
        description={
          error instanceof ApiError
            ? error.message
            : "The live backend could not prepare the complaint review workspace."
        }
        tone="error"
      />
    );
  }
}
