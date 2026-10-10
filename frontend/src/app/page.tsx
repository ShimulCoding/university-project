import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  FileCheck2,
  LockKeyhole,
  UsersRound,
} from "lucide-react";
import {
  listPublicEvents,
  listPublicFinancialSummaries,
} from "@/lib/api/public";
import {
  formatDate,
  formatEnumLabel,
  formatMoney,
  getEventStatusTone,
} from "@/lib/format";
import { PublicPageShell } from "@/components/shell/public-page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PublicFinancialSummary } from "@/types";

export const dynamic = "force-dynamic";

function LedgerPreview({
  summary,
}: {
  summary: PublicFinancialSummary | null;
}) {
  const collected = Number(summary?.totals.collected ?? 0);
  const spent = Number(summary?.totals.spent ?? 0);
  const maximum = Math.max(collected, spent, 1);
  return (
    <div className="ledger-scene relative isolate overflow-hidden rounded-[2rem] p-6 text-white shadow-lift sm:p-8">
      <div className="ledger-grid pointer-events-none absolute inset-0 -z-10" />
      <svg
        viewBox="0 0 380 180"
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-8 w-80 text-white/10"
      >
        <circle cx="190" cy="90" r="84" fill="none" stroke="currentColor" />
        <circle cx="190" cy="90" r="60" fill="none" stroke="currentColor" />
        <path d="M0 90H380M190 0V180" stroke="currentColor" />
        <circle cx="250" cy="90" r="5" fill="#a6dac6" />
      </svg>
      <div className="flex items-center justify-between gap-4">
        <div className="text-[11px] font-medium uppercase tracking-[.18em] text-white/65">
          The public ledger
        </div>
        <FileCheck2 className="h-5 w-5 text-[#a6dac6]" aria-hidden="true" />
      </div>
      <div className="mt-10 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] text-[#bde7d6]">
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
        {summary
          ? "Published financial summary"
          : "Approved reports appear here"}
      </div>
      <h2 className="mt-4 max-w-sm font-display text-3xl font-normal leading-tight text-white">
        {summary?.event.title ?? "A clear record. A stronger community."}
      </h2>
      <p className="mt-3 text-xs leading-6 text-white/65">
        {summary
          ? `Published ${formatDate(summary.publishedAt)} · BDT`
          : "Reconciled totals, shared once the event report is approved."}
      </p>
      <div className="mt-7 space-y-5 rounded-2xl border border-white/10 bg-white/[.06] p-5">
        {[
          {
            label: "Collected",
            value: summary?.totals.collected,
            color: "#b0dbc8",
            width: (collected / maximum) * 100,
          },
          {
            label: "Spent",
            value: summary?.totals.spent,
            color: "#cbb992",
            width: (spent / maximum) * 100,
          },
        ].map((item) => (
          <div key={item.label}>
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span className="text-white/70">{item.label}</span>
              <span className="font-mono text-base text-white">
                {item.value ? formatMoney(item.value) : "Awaiting report"}
              </span>
            </div>
            <div
              className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"
              aria-hidden="true"
            >
              <div
                className="h-full rounded-full"
                style={{ width: `${item.width}%`, backgroundColor: item.color }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-t border-white/15 pt-6">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-white/65">
            Closing balance
          </div>
          <div className="mt-2 break-words text-3xl font-semibold tabular-nums tracking-tight text-[#bde7d6]">
            {summary
              ? formatMoney(summary.totals.closingBalance)
              : "Not published"}
          </div>
        </div>
        <Link
          href={
            summary
              ? `/financial-summaries/${summary.event.slug}`
              : "/financial-summaries"
          }
          className="focus-ring flex h-11 w-11 items-center justify-center rounded-full border border-white/25 text-white transition-colors hover:bg-white/10"
          aria-label={
            summary
              ? "Read the latest financial report"
              : "Browse financial summaries"
          }
        >
          <ArrowUpRight className="h-5 w-5" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

export default async function HomePage() {
  const [eventResult, summaryResult] = await Promise.allSettled([
    listPublicEvents(),
    listPublicFinancialSummaries(),
  ]);
  const events = eventResult.status === "fulfilled" ? eventResult.value : [];
  const summaries =
    summaryResult.status === "fulfilled" ? summaryResult.value : [];
  const latestSummary = summaries[0] ?? null;
  const metrics = [
    {
      label: "Public events",
      value:
        eventResult.status === "fulfilled"
          ? eventResult.value.pagination.totalItems
          : "—",
      detail: "Published in the event directory",
    },
    {
      label: "Published reports",
      value:
        summaryResult.status === "fulfilled"
          ? summaryResult.value.pagination.totalItems
          : "—",
      detail: "Latest financial summary per event",
    },
    {
      label: "Recent open registrations",
      value:
        eventResult.status === "fulfilled"
          ? events.filter((event) => event.registrationWindow.state === "OPEN")
              .length
          : "—",
      detail: "Among the latest listed events",
    },
  ];
  return (
    <PublicPageShell>
      <main id="main-content" tabIndex={-1}>
        <section className="section-shell grid items-center gap-12 !py-12 sm:!py-16 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:!py-20">
          <div>
            <div className="editorial-rule">
              MU CSE Society · Open by purpose
            </div>
            <h1 className="mt-7 max-w-xl font-display text-5xl font-normal leading-[1.08] tracking-tight sm:text-6xl lg:text-[4.4rem]">
              Great events.
              <br />
              Clear finances.
              <br />
              <span className="italic text-success">Shared trust.</span>
            </h1>
            <p className="mt-7 max-w-lg text-base leading-8 text-muted-foreground sm:text-lg">
              Your society, in full view. Discover events, follow your
              participation, and see how approved funds were collected and
              spent.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/events">
                  Explore events <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/financial-summaries">View financial reports</Link>
              </Button>
            </div>
            <div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
              <LockKeyhole
                className="h-4 w-4 text-success"
                aria-hidden="true"
              />
              Open summaries. Protected personal records.
            </div>
          </div>
          <LedgerPreview summary={latestSummary} />
        </section>
        <section className="section-shell" aria-label="Platform at a glance">
          <div className="grid gap-6 border-y border-border py-7 sm:grid-cols-3 sm:gap-10">
            {metrics.map((metric, index) => (
              <div key={metric.label} className="flex items-start gap-4">
                <span className="mt-1 font-mono text-[10px] text-success">
                  0{index + 1}
                </span>
                <div>
                  <div className="text-3xl font-semibold tabular-nums tracking-tight">
                    {metric.value}
                  </div>
                  <div className="mt-2 text-sm font-medium">{metric.label}</div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {metric.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {eventResult.status === "rejected" ||
          summaryResult.status === "rejected" ? (
            <p role="status" className="mt-4 text-sm text-muted-foreground">
              Some live information is temporarily unavailable. Please try again
              shortly.
            </p>
          ) : null}
        </section>
        <section className="section-shell py-14 sm:py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="editorial-rule">The event directory</div>
              <h2 className="mt-4 font-display text-3xl font-normal sm:text-4xl">
                Find your next experience.
              </h2>
            </div>
            <Link
              className="focus-ring flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-success"
              href="/events"
            >
              Browse all events{" "}
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {events.slice(0, 3).map((event, index) => (
              <article
                key={event.id}
                className="group flex min-w-0 flex-col rounded-2xl border border-border bg-panel p-6 transition-colors hover:border-success/40"
              >
                <div className="flex items-center justify-between gap-3">
                  <Badge variant={getEventStatusTone(event.status)}>
                    {formatEnumLabel(event.status)}
                  </Badge>
                  <span className="font-mono text-xs text-muted-foreground">
                    0{index + 1}
                  </span>
                </div>
                <h3 className="mt-6 text-xl font-semibold leading-snug">
                  {event.title}
                </h3>
                <p className="mt-3 line-clamp-3 text-sm leading-7 text-muted-foreground">
                  {event.description ??
                    "Discover the program and its registration details."}
                </p>
                <div className="mt-auto pt-6">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CalendarDays className="h-4 w-4" aria-hidden="true" />
                    {formatDate(event.schedule.startsAt)}
                  </div>
                  <Link
                    className="focus-ring mt-5 flex min-h-11 items-center justify-between rounded-lg border-t border-border pt-4 text-sm font-semibold text-success"
                    href={`/events/${event.slug}`}
                  >
                    View event{" "}
                    <ArrowRight
                      className="h-4 w-4 transition-transform group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </Link>
                </div>
              </article>
            ))}
            {events.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-8 text-sm leading-7 text-muted-foreground md:col-span-3">
                {eventResult.status === "rejected"
                  ? "The event directory could not be loaded. Open the directory to try again."
                  : "New society events will appear here after publication."}
              </div>
            ) : null}
          </div>
        </section>
        <section className="border-y border-border bg-panel">
          <div className="section-shell grid gap-10 py-14 sm:py-20 lg:grid-cols-[.8fr_1.2fr]">
            <div>
              <div className="editorial-rule">A community built on clarity</div>
              <h2 className="mt-4 font-display text-3xl font-normal leading-tight sm:text-4xl">
                The right information.
                <br />
                <span className="italic text-success">In the right hands.</span>
              </h2>
              <p className="mt-5 max-w-sm text-sm leading-7 text-muted-foreground">
                From your first registration to an event&apos;s final report,
                every step has a clear place.
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              {[
                {
                  icon: UsersRound,
                  title: "Your participation",
                  detail:
                    "Register for an event, submit payment evidence, and follow your own updates.",
                  href: "/events",
                  action: "Find an event",
                },
                {
                  icon: FileCheck2,
                  title: "The complete picture",
                  detail:
                    "Explore approved financial summaries, category breakdowns, and downloadable reports.",
                  href: "/financial-summaries",
                  action: "Explore the reports",
                },
              ].map(({ icon: Icon, title, detail, href, action }) => (
                <div
                  key={title}
                  className="rounded-2xl border border-border bg-canvas p-6"
                >
                  <Icon className="h-6 w-6 text-success" aria-hidden="true" />
                  <h3 className="mt-5 text-base font-semibold">{title}</h3>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">
                    {detail}
                  </p>
                  <Link
                    href={href}
                    className="focus-ring mt-5 flex min-h-11 w-fit items-center gap-2 rounded-lg text-sm font-semibold text-success"
                  >
                    {action}{" "}
                    <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </PublicPageShell>
  );
}
