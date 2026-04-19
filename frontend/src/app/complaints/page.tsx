import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  FileWarning,
  MessageSquareText,
  Route,
} from "lucide-react";

import type { ComplaintRecord, ComplaintRoutingSummary, ComplaintState } from "@/types";
import { getCurrentUser, listMyComplaints } from "@/lib/api/student";
import { ApiError, buildApiUrl } from "@/lib/api/shared";
import { formatDateTime, formatEnumLabel, getComplaintStateTone } from "@/lib/format";
import { StudentAccessPanel } from "@/components/student/student-access-panel";
import { StudentSessionCard } from "@/components/student/student-session-card";
import { PublicPageShell } from "@/components/shell/public-page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatePanel } from "@/components/ui/state-panel";

export const dynamic = "force-dynamic";

const complaintTrackingCopy: Record<ComplaintState, { title: string; nextStep: string }> = {
  SUBMITTED: {
    title: "Complaint received",
    nextStep: "The complaint is waiting for a reviewer to start the internal review.",
  },
  UNDER_REVIEW: {
    title: "Under review",
    nextStep: "A reviewer is checking the complaint details and evidence.",
  },
  ROUTED: {
    title: "Routed",
    nextStep: "The complaint has been routed to the responsible internal role.",
  },
  ESCALATED: {
    title: "Escalated",
    nextStep: "The complaint has been raised for higher-priority oversight.",
  },
  RESOLVED: {
    title: "Resolved",
    nextStep: "The review team marked the complaint as resolved. It may be closed afterward.",
  },
  CLOSED: {
    title: "Closed",
    nextStep: "The complaint lifecycle is complete and remains available for your records.",
  },
};

function formatComplaintReference(complaintId: string) {
  return `CMP-${complaintId.slice(-8).toUpperCase()}`;
}

function getStudentTrackingEvents(complaint: ComplaintRecord): ComplaintRoutingSummary[] {
  const hasSubmittedEvent = complaint.routingHistory.some(
    (routing) => routing.state === "SUBMITTED",
  );

  if (hasSubmittedEvent) {
    return complaint.routingHistory;
  }

  return [
    {
      id: `${complaint.id}-submitted`,
      state: "SUBMITTED",
      createdAt: complaint.createdAt,
      note: null,
      fromRole: null,
      toRole: null,
      routedBy: null,
    },
    ...complaint.routingHistory,
  ];
}

function getLatestTrackingEvent(complaint: ComplaintRecord) {
  return getStudentTrackingEvents(complaint).at(-1);
}

function TrackingTimeline({ complaint }: { complaint: ComplaintRecord }) {
  const trackingEvents = getStudentTrackingEvents(complaint);

  return (
    <div className="rounded-[1rem] border border-border/70 bg-panel px-4 py-4">
      <div className="data-kicker">Tracking timeline</div>
      <div className="mt-4 space-y-4">
        {trackingEvents.map((routing, index) => (
          <div key={routing.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/10 bg-panel-muted text-primary">
                {index === 0 ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Route className="h-4 w-4" />
                )}
              </div>
              {index < trackingEvents.length - 1 ? (
                <div className="mt-2 h-full min-h-6 w-px bg-border" />
              ) : null}
            </div>
            <div className="pb-1 text-sm leading-6">
              <div className="font-semibold text-foreground">
                {formatEnumLabel(routing.state)}
              </div>
              <div className="text-muted-foreground">
                {formatDateTime(routing.createdAt)}
                {routing.toRole ? ` / Sent to ${routing.toRole.name}` : ""}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function MyComplaintsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  try {
    const params = await searchParams;
    const submittedComplaintId =
      typeof params.submittedComplaintId === "string"
        ? params.submittedComplaintId
        : undefined;
    const user = await getCurrentUser();

    if (!user) {
      return (
        <PublicPageShell>
          <main className="section-shell py-12 sm:py-16">
            <PageHeader
              eyebrow="My complaints"
              title="Sign in to view your complaints"
              description="Complaint records are private and tied to the submitting student session."
            />
            <div className="mt-8">
              <StudentAccessPanel
                title="Open your private complaint history"
                description="Sign in or create student access to review complaint status and protected routing history."
              />
            </div>
          </main>
        </PublicPageShell>
      );
    }

    const complaints = await listMyComplaints();
    const acknowledgedComplaint = submittedComplaintId
      ? complaints.find((complaint) => complaint.id === submittedComplaintId) ?? null
      : null;

    return (
      <PublicPageShell>
        <main className="section-shell py-12 sm:py-16">
          <PageHeader
            eyebrow="My complaints"
            title="Complaint records owned by your student session"
            description="This list is private. It shows the current complaint state and high-level routing history without exposing reviewer-only internals."
            action={
              <Button asChild size="sm">
                <Link href="/complaints/new">
                  Submit complaint
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            }
          />

          {acknowledgedComplaint ? (
            <Card tone="success" className="mt-8">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="success">Acknowledgement received</Badge>
                  <Badge variant={getComplaintStateTone(acknowledgedComplaint.state)}>
                    {formatEnumLabel(acknowledgedComplaint.state)}
                  </Badge>
                </div>
                <CardTitle className="mt-4 text-2xl">
                  Complaint received: {formatComplaintReference(acknowledgedComplaint.id)}
                </CardTitle>
                <CardDescription>
                  Your complaint has been saved in the protected review queue. Use this
                  reference when checking status with the society team.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 pt-0 md:grid-cols-3">
                <div className="rounded-[1rem] border border-success/15 bg-panel px-4 py-4 text-sm leading-6 text-muted-foreground">
                  <span className="block font-semibold text-foreground">Submitted</span>
                  {formatDateTime(acknowledgedComplaint.createdAt)}
                </div>
                <div className="rounded-[1rem] border border-success/15 bg-panel px-4 py-4 text-sm leading-6 text-muted-foreground">
                  <span className="block font-semibold text-foreground">Current status</span>
                  {complaintTrackingCopy[acknowledgedComplaint.state].title}
                </div>
                <div className="rounded-[1rem] border border-success/15 bg-panel px-4 py-4 text-sm leading-6 text-muted-foreground">
                  <span className="block font-semibold text-foreground">Next step</span>
                  {complaintTrackingCopy[acknowledgedComplaint.state].nextStep}
                </div>
              </CardContent>
            </Card>
          ) : submittedComplaintId ? (
            <div className="mt-8">
              <StatePanel
                icon={AlertTriangle}
                tone="warning"
                title="Complaint acknowledgement is not visible yet"
                description="The complaint may still be loading or may belong to another student session. Refresh this page after a moment."
              />
            </div>
          ) : null}

          <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_360px]">
            <div className="space-y-6">
              {complaints.length === 0 ? (
                <StatePanel
                  icon={MessageSquareText}
                  tone="empty"
                  title="No complaints have been submitted from this session"
                  description="If you need to raise a concern, you can submit one now and track its protected status here afterward."
                  action={
                    <Button asChild size="sm">
                      <Link href="/complaints/new">Submit complaint</Link>
                    </Button>
                  }
                />
              ) : (
                complaints.map((complaint) => {
                  const latestRouting = getLatestTrackingEvent(complaint);
                  const trackingCopy = complaintTrackingCopy[complaint.state];

                  return (
                    <Card
                      key={complaint.id}
                      className={
                        submittedComplaintId === complaint.id
                          ? "border-success/30 ring-2 ring-success/10"
                          : undefined
                      }
                    >
                      <CardHeader>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={getComplaintStateTone(complaint.state)}>
                            {formatEnumLabel(complaint.state)}
                          </Badge>
                          <Badge variant="info">{formatComplaintReference(complaint.id)}</Badge>
                          {complaint.event ? (
                            <Badge variant="neutral">{complaint.event.title}</Badge>
                          ) : (
                            <Badge variant="neutral">General complaint</Badge>
                          )}
                        </div>
                        <CardTitle className="mt-4 text-xl">{complaint.subject}</CardTitle>
                        <CardDescription>{complaint.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid gap-3 md:grid-cols-3">
                          <div className="rounded-[1rem] border border-border/70 bg-panel-muted px-4 py-4 text-sm text-muted-foreground">
                            Submitted {formatDateTime(complaint.createdAt)}
                          </div>
                          <div className="rounded-[1rem] border border-border/70 bg-panel-muted px-4 py-4 text-sm text-muted-foreground">
                            {latestRouting
                              ? `${formatEnumLabel(latestRouting.state)} on ${formatDateTime(
                                  latestRouting.createdAt,
                                )}`
                              : "Awaiting internal review update"}
                          </div>
                          <div className="rounded-[1rem] border border-border/70 bg-panel-muted px-4 py-4 text-sm text-muted-foreground">
                            Evidence files: {complaint.evidence.length}
                          </div>
                        </div>
                        <div className="rounded-[1rem] border border-border/70 bg-panel-muted px-4 py-4 text-sm leading-6 text-muted-foreground">
                          <span className="font-semibold text-foreground">
                            {trackingCopy.title}.
                          </span>{" "}
                          {trackingCopy.nextStep}
                        </div>
                        <TrackingTimeline complaint={complaint} />
                        {complaint.evidence.length > 0 ? (
                          <div className="rounded-[1rem] border border-border/70 bg-panel px-4 py-4">
                            <div className="data-kicker">Submitted evidence</div>
                            <div className="mt-3 grid gap-3">
                              {complaint.evidence.map((document) => (
                                <Button
                                  key={document.id}
                                  asChild
                                  variant="outline"
                                  size="sm"
                                  className="justify-between"
                                >
                                  <a
                                    href={buildApiUrl(document.viewPath)}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    {document.originalName}
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                </Button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>

            <div className="space-y-6">
              <StudentSessionCard user={user} />
              <Card tone="muted">
                <CardHeader>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/10 bg-primary/5 text-primary">
                    <FileWarning className="h-5 w-5" />
                  </div>
                  <CardTitle className="mt-4 text-xl">Protected review boundary</CardTitle>
                  <CardDescription>
                    You can track complaint state and routing progression here, but reviewer-only notes and internal handling detail remain protected.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </main>
      </PublicPageShell>
    );
  } catch (error) {
    return (
      <PublicPageShell>
        <main className="section-shell py-12 sm:py-16">
          <PageHeader
            eyebrow="My complaints"
            title="Complaint history could not be loaded"
            description="The private complaint area depends on an active student session and live backend data."
          />
          <div className="mt-10">
            <StatePanel
              icon={AlertTriangle}
              tone="error"
              title="Complaint history is unavailable"
              description={
                error instanceof ApiError
                  ? error.message
                  : "An unexpected error prevented your complaint history from loading."
              }
            />
          </div>
        </main>
      </PublicPageShell>
    );
  }
}
