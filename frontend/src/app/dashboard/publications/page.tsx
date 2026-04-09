import {
  disclosureBoundary,
  publicationChecklist,
  publishedSummaries,
} from "@/features/foundation/data/demo-content";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export default function DashboardPublicationsPage() {
  const summary = publishedSummaries[0];

  return (
    <>
      <PageHeader
        eyebrow="Publication boundary"
        title="Internal teams see the boundary before they see the publish action"
        description="The UI keeps publication logic explicit: finalized reconciliation, completed or closed event state, and public-safe summary shaping."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_0.9fr]">
        <Card>
          <CardHeader>
            <Badge variant="success">Publish-safe snapshot</Badge>
            <CardTitle className="mt-3 text-2xl">{summary.title}</CardTitle>
            <CardDescription>{summary.note}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[1.2rem] border border-border/70 bg-panel-muted px-4 py-4">
              <div className="data-kicker">Collected</div>
              <div className="mt-2 text-2xl font-semibold text-foreground">
                {summary.totals.collected}
              </div>
            </div>
            <div className="rounded-[1.2rem] border border-border/70 bg-panel-muted px-4 py-4">
              <div className="data-kicker">Spent</div>
              <div className="mt-2 text-2xl font-semibold text-foreground">
                {summary.totals.spent}
              </div>
            </div>
            <div className="rounded-[1.2rem] border border-border/70 bg-panel-muted px-4 py-4">
              <div className="data-kicker">Closing balance</div>
              <div className="mt-2 text-2xl font-semibold text-foreground">
                {summary.totals.closingBalance}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <Badge variant="info">Publish checklist</Badge>
              <CardTitle className="mt-3">The public release boundary stays explicit</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {publicationChecklist.map((item, index) => (
                <div
                  key={item}
                  className="flex items-start gap-3 rounded-[1.1rem] border border-border/70 bg-panel-muted px-4 py-4 text-sm leading-6 text-muted-foreground"
                >
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-primary/10 bg-panel text-xs font-semibold text-primary">
                    {index + 1}
                  </div>
                  <span>{item}</span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card tone="success">
            <CardHeader>
              <CardTitle>Allowed into public pages</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {disclosureBoundary.publicIncluded.map((item) => (
                <div
                  key={item}
                  className="rounded-[1.1rem] border border-success/15 bg-panel px-4 py-4 text-sm leading-6 text-muted-foreground"
                >
                  {item}
                </div>
              ))}
            </CardContent>
          </Card>
          <Card tone="muted">
            <CardHeader>
              <CardTitle>Blocked from public pages</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {disclosureBoundary.publicExcluded.map((item) => (
                <div
                  key={item}
                  className="rounded-[1.1rem] border border-border/70 bg-panel px-4 py-4 text-sm leading-6 text-muted-foreground"
                >
                  {item}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
