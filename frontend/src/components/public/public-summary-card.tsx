import Link from "next/link";
import { ArrowRight, BadgeDollarSign, FileCheck2 } from "lucide-react";

import type { PublicFinancialSummary } from "@/types";
import { formatDate, formatEnumLabel, formatMoney } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function PublicSummaryCard({ summary }: { summary: PublicFinancialSummary }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="success">Latest {formatEnumLabel(summary.status)}</Badge>
          <Badge variant="neutral">Published {formatDate(summary.publishedAt)}</Badge>
        </div>
        <CardTitle className="mt-4 text-2xl">{summary.event.title}</CardTitle>
        <CardDescription>
          Latest summary-only public disclosure based on finalized reconciliation for this event.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-[1.15rem] border border-border/70 bg-panel-muted px-4 py-4">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <BadgeDollarSign className="h-4 w-4 text-primary" />
              Collected
            </div>
            <div className="mt-2 text-lg font-semibold text-foreground">
              {formatMoney(summary.totals.collected)}
            </div>
          </div>
          <div className="rounded-[1.15rem] border border-border/70 bg-panel-muted px-4 py-4">
            <div className="text-sm font-medium text-foreground">Spent</div>
            <div className="mt-2 text-lg font-semibold text-foreground">
              {formatMoney(summary.totals.spent)}
            </div>
          </div>
          <div className="rounded-[1.15rem] border border-border/70 bg-panel-muted px-4 py-4">
            <div className="text-sm font-medium text-foreground">Closing balance</div>
            <div className="mt-2 text-lg font-semibold text-foreground">
              {formatMoney(summary.totals.closingBalance)}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileCheck2 className="h-4 w-4 text-success" />
            Finalized reconciliation only
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={`/financial-summaries/${summary.event.slug}`}>
              Open details
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
