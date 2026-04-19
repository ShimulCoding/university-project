import { AlertTriangle, FileWarning } from "lucide-react";

import { listPublicEvents } from "@/lib/api/public";
import { getCurrentUser, listMyComplaints } from "@/lib/api/student";
import { ApiError } from "@/lib/api/shared";
import { ComplaintForm } from "@/components/student/complaint-form";
import { ComplaintUpdateSummary } from "@/components/student/complaint-update-summary";
import { StudentAccessPanel } from "@/components/student/student-access-panel";
import { StudentSessionCard } from "@/components/student/student-session-card";
import { PublicPageShell } from "@/components/shell/public-page-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatePanel } from "@/components/ui/state-panel";

export const dynamic = "force-dynamic";

export default async function ComplaintSubmissionPage() {
  try {
    const [user, events] = await Promise.all([getCurrentUser(), listPublicEvents()]);
    const complaints = user ? await listMyComplaints() : [];

    return (
      <PublicPageShell>
        <main className="section-shell py-12 sm:py-16">
          <PageHeader
            eyebrow="Complaint submission"
            title="Submit a private complaint"
            description="Complaints are student-owned, evidence-aware, and intentionally separated from public event and publication views."
          />

          {user ? (
            <div className="mt-8">
              <ComplaintUpdateSummary complaints={complaints} />
            </div>
          ) : null}

          <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_360px]">
            <div className="space-y-6">
              {!user ? (
                <StudentAccessPanel
                  title="Sign in to submit a complaint"
                  description="Complaint submission requires a private session because evidence, routing history, and complaint details are protected."
                />
              ) : (
                <ComplaintForm events={events} />
              )}
            </div>

            <div className="space-y-6">
              {user ? (
                <StudentSessionCard user={user} />
              ) : (
                <Card tone="muted">
                  <CardHeader>
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/10 bg-primary/5 text-primary">
                      <FileWarning className="h-5 w-5" />
                    </div>
                    <CardTitle className="mt-4 text-xl">Protected complaint workflow</CardTitle>
                    <CardDescription>
                      Complaint submission is not public. Routing history and attached evidence remain protected after you submit.
                    </CardDescription>
                  </CardHeader>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">What stays private</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <div className="rounded-[1rem] border border-border/70 bg-panel-muted px-4 py-4 text-sm leading-6 text-muted-foreground">
                    Complaint subject, description, evidence metadata, and routing history.
                  </div>
                  <div className="rounded-[1rem] border border-border/70 bg-panel-muted px-4 py-4 text-sm leading-6 text-muted-foreground">
                    Reviewer-side actions such as routing, escalation, and closure notes.
                  </div>
                </CardContent>
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
            eyebrow="Complaint submission"
            title="Complaint submission is temporarily unavailable"
            description="The live backend could not prepare the protected complaint workflow right now."
          />
          <div className="mt-10">
            <StatePanel
              icon={AlertTriangle}
              tone="error"
              title="Complaint submission could not be loaded"
              description={
                error instanceof ApiError
                  ? error.message
                  : "An unexpected error prevented the complaint form from loading."
              }
            />
          </div>
        </main>
      </PublicPageShell>
    );
  }
}
