import { CheckCircle2, EyeOff } from "lucide-react";

import {
  disclosureBoundary,
  publicationChecklist,
  publishedSummaries,
} from "@/features/foundation/data/demo-content";
import { PublicPageShell } from "@/components/shell/public-page-shell";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function FinancialSummariesPage() {
  return (
    <PublicPageShell>
      <main className="section-shell py-12 sm:py-16">
        <PageHeader
          eyebrow="Published summaries"
          title="Public-safe financial outcomes, not raw internal operations"
          description="Published summaries are derived from finalized reconciliation and intentionally exclude evidence files, reviewer notes, and protected complaint detail."
        />

        <div className="mt-10 grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_380px]">
          <div className="space-y-6">
            {publishedSummaries.map((summary) => (
              <Card key={summary.slug}>
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="success">Published</Badge>
                    <Badge variant="neutral">{summary.publishedAt}</Badge>
                  </div>
                  <CardTitle className="mt-4 text-2xl">{summary.title}</CardTitle>
                  <CardDescription>{summary.note}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-3">
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
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Summary line</TableHead>
                        <TableHead>Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-semibold text-foreground">
                          Verified registration income
                        </TableCell>
                        <TableCell>{summary.breakdown.registrationIncome}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-semibold text-foreground">
                          Manual income records
                        </TableCell>
                        <TableCell>{summary.breakdown.manualIncome}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-semibold text-foreground">
                          Settled expense records
                        </TableCell>
                        <TableCell>{summary.breakdown.settledExpense}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <Badge variant="info">Release conditions</Badge>
                <CardTitle className="mt-3 text-xl">A summary becomes public only after closure logic passes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                {publicationChecklist.map((item, index) => (
                  <div
                    key={item}
                    className="flex items-start gap-3 rounded-[1.15rem] border border-border/70 bg-panel-muted px-4 py-4 text-sm leading-6 text-muted-foreground"
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
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  <CardTitle className="text-xl">Included publicly</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                {disclosureBoundary.publicIncluded.map((item) => (
                  <div
                    key={item}
                    className="rounded-[1.15rem] border border-success/15 bg-panel px-4 py-4 text-sm leading-6 text-muted-foreground"
                  >
                    {item}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card tone="muted">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <EyeOff className="h-5 w-5 text-warning-foreground" />
                  <CardTitle className="text-xl">Kept protected</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                {disclosureBoundary.publicExcluded.map((item) => (
                  <div
                    key={item}
                    className="rounded-[1.15rem] border border-border/70 bg-panel px-4 py-4 text-sm leading-6 text-muted-foreground"
                  >
                    {item}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </PublicPageShell>
  );
}
