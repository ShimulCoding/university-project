import Link from "next/link";
import { AlertTriangle, ArrowRight, FileWarning, MessageSquareText } from "lucide-react";

import { getCurrentUser, listMyComplaints } from "@/lib/api/student";
import { ApiError } from "@/lib/api/shared";
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

export default async function MyComplaintsPage() {
  try {
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
                complaints.map((complaint) => (
                  <Card key={complaint.id}>
                    <CardHeader>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={getComplaintStateTone(complaint.state)}>
                          {formatEnumLabel(complaint.state)}
                        </Badge>
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
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-[1rem] border border-border/70 bg-panel-muted px-4 py-4 text-sm text-muted-foreground">
                          Submitted {formatDateTime(complaint.createdAt)}
                        </div>
                        <div className="rounded-[1rem] border border-border/70 bg-panel-muted px-4 py-4 text-sm text-muted-foreground">
                          Evidence files: {complaint.evidence.length}
                        </div>
                      </div>
                      {complaint.routingHistory.length > 0 ? (
                        <div className="rounded-[1rem] border border-border/70 bg-panel px-4 py-4">
                          <div className="data-kicker">Routing history</div>
                          <div className="mt-3 space-y-3">
                            {complaint.routingHistory.map((routing) => (
                              <div key={routing.id} className="text-sm leading-6 text-muted-foreground">
                                <span className="font-medium text-foreground">
                                  {formatEnumLabel(routing.state)}
                                </span>{" "}
                                on {formatDateTime(routing.createdAt)}
                                {routing.toRole ? ` to ${routing.toRole.name}` : ""}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                ))
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
