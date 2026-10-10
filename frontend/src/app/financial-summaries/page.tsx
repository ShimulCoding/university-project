import { AlertTriangle, FileCheck2, Landmark, Archive } from "lucide-react";
import { ListPagination } from "@/components/ui/list-pagination";
import { queryPage } from "@/lib/api/list";
import { listPublicFinancialSummaries } from "@/lib/api/public";
import { ApiError } from "@/lib/api/shared";
import { formatMoney, sumExactMoney } from "@/lib/format";
import { PublicSummaryCard } from "@/components/public/public-summary-card";
import { PublicPageShell } from "@/components/shell/public-page-shell";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { StatePanel } from "@/components/ui/state-panel";
import { FilterCard } from "@/components/internal/filter-card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  getHistoricalPublishedSnapshotCount,
  getLatestPublishedSummariesPerEvent,
} from "@/lib/public-summary";

export const dynamic = "force-dynamic";
export default async function FinancialSummariesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const search =
    typeof params.search === "string"
      ? params.search.trim().slice(0, 200) || undefined
      : undefined;
  try {
    const summaries = await listPublicFinancialSummaries({
      page: queryPage(params.page),
      ...(search ? { search } : {}),
    });
    const latest = getLatestPublishedSummariesPerEvent(summaries);
    const history =
      summaries.pagination.historicalSnapshotCount ??
      getHistoricalPublishedSnapshotCount(summaries);
    const collected = sumExactMoney(
      latest.map((summary) => summary.totals.collected),
    );
    return (
      <PublicPageShell>
        <main
          id="main-content"
          tabIndex={-1}
          className="section-shell py-10 sm:py-14"
        >
          <PageHeader
            eyebrow="Open financial reporting"
            title="Every event. A clear account."
            description="See where funds came from, how they were spent, and what remains. Explore the latest approved financial summary for each event."
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <MetricCard
              label="Published event reports"
              value={summaries.pagination.totalItems}
              detail="Latest approved summary per event"
              icon={FileCheck2}
            />
            <MetricCard
              label="Collections on this page"
              value={formatMoney(collected)}
              detail="Across the event summaries listed below"
              icon={Landmark}
            />
            <MetricCard
              label="Historical snapshots"
              value={history}
              detail="Earlier publications retained for audit history"
              icon={Archive}
            />
          </div>
          <div className="mt-8">
            <FilterCard resetHref="/financial-summaries">
              <Field label="Find a financial report">
                <Input
                  type="search"
                  name="search"
                  defaultValue={search ?? ""}
                  maxLength={200}
                  placeholder="Search by event name…"
                />
              </Field>
            </FilterCard>
          </div>
          <div className="mt-8 flex items-baseline justify-between gap-4">
            <h2 className="text-xl font-semibold">
              {search ? "Matching reports" : "Published financial summaries"}
            </h2>
            <span className="text-xs text-muted-foreground">
              Amounts in BDT
            </span>
          </div>
          <div className="mt-5">
            {latest.length ? (
              <div className="grid gap-5 lg:grid-cols-2">
                {latest.map((summary) => (
                  <PublicSummaryCard key={summary.id} summary={summary} />
                ))}
              </div>
            ) : (
              <StatePanel
                icon={FileCheck2}
                title={
                  search
                    ? "No matching reports"
                    : "No financial reports published yet"
                }
                description={
                  search
                    ? "Try a different event name, or reset your search to see all reports."
                    : "An event’s summary appears here after its reconciliation is finalized and approved for publication."
                }
              />
            )}
          </div>
          <ListPagination pagination={summaries.pagination} />
        </main>
      </PublicPageShell>
    );
  } catch (error) {
    return (
      <PublicPageShell>
        <main
          id="main-content"
          tabIndex={-1}
          className="section-shell space-y-8 py-12"
        >
          <PageHeader
            eyebrow="Open financial reporting"
            title="Financial summaries."
            description="A clear account of society events."
          />
          <StatePanel
            icon={AlertTriangle}
            tone="error"
            title="Reports are temporarily unavailable"
            description={
              error instanceof ApiError
                ? error.message
                : "Please try loading the reports again shortly."
            }
          />
        </main>
      </PublicPageShell>
    );
  }
}
