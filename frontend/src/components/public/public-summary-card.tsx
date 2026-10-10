import Link from "next/link";
import { ArrowUpRight, FileCheck2 } from "lucide-react";
import type { PublicFinancialSummary } from "@/types";
import { formatDate, formatMoney } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function PublicSummaryCard({
  summary,
}: {
  summary: PublicFinancialSummary;
}) {
  return (
    <article className="group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-panel shadow-panel transition-colors hover:border-success/40">
      <div className="flex-1 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Badge variant="success">
            <FileCheck2 className="h-3.5 w-3.5" aria-hidden="true" />
            Published summary
          </Badge>
          <span className="text-xs text-muted-foreground">
            {formatDate(summary.publishedAt)}
          </span>
        </div>
        <h3 className="mt-5 text-2xl font-semibold leading-snug tracking-tight">
          <Link
            className="focus-ring rounded-lg hover:text-success"
            href={`/financial-summaries/${summary.event.slug}`}
          >
            {summary.event.title}
          </Link>
        </h3>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          The latest approved report, based on finalized reconciliation.
        </p>
        <dl className="mt-6 grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Collected</dt>
            <dd className="mt-2 break-words text-2xl font-semibold tabular-nums tracking-tight">
              {formatMoney(summary.totals.collected)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Spent</dt>
            <dd className="mt-2 break-words text-2xl font-semibold tabular-nums tracking-tight">
              {formatMoney(summary.totals.spent)}
            </dd>
          </div>
        </dl>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-success/15 bg-accent px-6 py-5">
        <div>
          <div className="text-xs text-success">Closing balance</div>
          <div className="mt-1 break-words text-xl font-semibold tabular-nums tracking-tight text-success">
            {formatMoney(summary.totals.closingBalance)}
          </div>
        </div>
        <Button
          asChild
          variant="outline"
          size="sm"
          className="border-success/20 bg-panel"
        >
          <Link href={`/financial-summaries/${summary.event.slug}`}>
            Open details <ArrowUpRight aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </article>
  );
}
