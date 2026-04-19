import Link from "next/link";
import { CheckCircle2, MessageSquareText, Route } from "lucide-react";

import type { ComplaintRecord, ComplaintState } from "@/types";
import { formatDateTime, formatEnumLabel, getComplaintStateTone } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatePanel } from "@/components/ui/state-panel";

const complaintTrackingCopy: Record<ComplaintState, { title: string; nextStep: string }> = {
  SUBMITTED: {
    title: "Complaint received",
    nextStep: "Waiting for an internal reviewer to start the review.",
  },
  UNDER_REVIEW: {
    title: "Under review",
    nextStep: "A reviewer is checking the complaint details and evidence.",
  },
  ROUTED: {
    title: "Routed",
    nextStep: "Sent to the responsible internal role for handling.",
  },
  ESCALATED: {
    title: "Escalated",
    nextStep: "Raised for higher-priority oversight.",
  },
  RESOLVED: {
    title: "Resolved",
    nextStep: "Marked resolved by the review team; closure may follow.",
  },
  CLOSED: {
    title: "Closed",
    nextStep: "Complaint lifecycle is complete and kept in your history.",
  },
};

function formatComplaintReference(complaintId: string) {
  return `CMP-${complaintId.slice(-8).toUpperCase()}`;
}

function getLatestUpdate(complaint: ComplaintRecord) {
  return complaint.routingHistory.at(-1) ?? {
    id: `${complaint.id}-submitted`,
    state: "SUBMITTED" as ComplaintState,
    createdAt: complaint.createdAt,
    note: null,
    fromRole: null,
    toRole: null,
    routedBy: null,
  };
}

export function ComplaintUpdateSummary({ complaints }: { complaints: ComplaintRecord[] }) {
  return (
    <Card tone="success">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="success">Your complaint updates</Badge>
          <Badge variant="neutral">{complaints.length} record(s)</Badge>
        </div>
        <CardTitle className="mt-4 text-2xl">
          Previous acknowledgements and latest status updates
        </CardTitle>
        <CardDescription>
          Before submitting another concern, review what already exists in your student-owned
          complaint history.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {complaints.length === 0 ? (
          <StatePanel
            icon={MessageSquareText}
            tone="empty"
            title="No previous complaints from this student session"
            description="After you submit a concern, its acknowledgement, reference number, and status updates will appear here."
          />
        ) : (
          complaints.map((complaint) => {
            const latestUpdate = getLatestUpdate(complaint);
            const trackingCopy = complaintTrackingCopy[complaint.state];

            return (
              <div
                key={complaint.id}
                className="rounded-[1.2rem] border border-success/15 bg-panel px-4 py-4"
              >
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

                <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{complaint.subject}</h3>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                      {complaint.description}
                    </p>
                    <div className="mt-3 rounded-[1rem] border border-border/70 bg-panel-muted px-4 py-3 text-sm leading-6 text-muted-foreground">
                      <span className="font-semibold text-foreground">{trackingCopy.title}.</span>{" "}
                      {trackingCopy.nextStep}
                    </div>
                  </div>

                  <div className="space-y-3 text-sm leading-6 text-muted-foreground">
                    <div className="rounded-[1rem] border border-border/70 bg-panel-muted px-4 py-3">
                      <span className="block font-semibold text-foreground">Acknowledged</span>
                      {formatDateTime(complaint.createdAt)}
                    </div>
                    <div className="rounded-[1rem] border border-border/70 bg-panel-muted px-4 py-3">
                      <span className="flex items-center gap-2 font-semibold text-foreground">
                        {latestUpdate.state === "SUBMITTED" ? (
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        ) : (
                          <Route className="h-4 w-4 text-primary" />
                        )}
                        Latest update
                      </span>
                      {formatEnumLabel(latestUpdate.state)} / {formatDateTime(latestUpdate.createdAt)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href="/complaints">Open full complaint history</Link>
          </Button>
          <span className="text-sm text-muted-foreground">
            This page now shows previous updates before the new complaint form.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
