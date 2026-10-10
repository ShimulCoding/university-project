import { ListPagination } from "@/components/ui/list-pagination";
import { queryPage } from "@/lib/api/list";
import Link from "next/link";
import { AlertTriangle, SearchSlash, ShieldAlert, Wallet, CalendarDays, Tag, FileText, TrendingUp } from "lucide-react";

import { getCurrentUser } from "@/lib/api/student";
import { getEventRolesForEvent, isSystemAdmin } from "@/lib/access";
import {
  getIncomeRecord,
  listIncomeRecords,
} from "@/lib/api/internal";
import { apiFetchServer } from "@/lib/api/server";
import { buildRelativeHref } from "@/lib/detail-query";
import { ApiError } from "@/lib/api/shared";
import {
  formatDate,
  formatDateTime,
  formatEnumLabel,
  formatMoney,
  getIncomeStateTone,
} from "@/lib/format";
import type { ManagedEvent } from "@/types";
import { IncomeRecordForm, IncomeRecordStatePanel } from "@/components/internal/payments-actions";
import { FilterCard } from "@/components/internal/filter-card";
import { SupportingDocumentList } from "@/components/internal/supporting-document-list";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { StatePanel } from "@/components/ui/state-panel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

async function getEventBySlug(slug: string) {
  try {
    const response = await apiFetchServer<{ event: ManagedEvent }>(`/events/manage/${slug}`);
    return response.event;
  } catch {
    return null;
  }
}

export default async function EventIncomeRecordsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sParams = await searchParams;
  const search = typeof sParams.search === "string" ? sParams.search : undefined;
  const incomeRecordId =
    typeof sParams.incomeRecordId === "string" ? sParams.incomeRecordId : undefined;

  const [user, event] = await Promise.all([getCurrentUser(), getEventBySlug(slug)]);

  if (!user || !event) return null;

  const eventRoles = isSystemAdmin(user) ? ["SYSTEM_ADMIN" as const] : getEventRolesForEvent(user, event.id);
  const canSeeIncomeRecords = isSystemAdmin(user) || eventRoles.includes("EVENT_ADMIN") || eventRoles.includes("FINANCIAL_CONTROLLER");

  if (!canSeeIncomeRecords) {
    return <StatePanel icon={ShieldAlert} tone="warning" title="Access restricted" description="Your event role does not include access to view income records." />;
  }

  const canManageIncomeRecords = eventRoles.includes("FINANCIAL_CONTROLLER");

  try {
    const incomeRecords = await listIncomeRecords({ page: queryPage(sParams.page), eventId: event.id, search });
    const eventsArray = [event]; // Lock composer to this event

    const selectedIncomeRecordId =
      incomeRecords.find((record) => record.id === incomeRecordId)?.id ?? incomeRecords[0]?.id;
    const selectedIncome = selectedIncomeRecordId
      ? await getIncomeRecord(selectedIncomeRecordId)
      : null;

    const basePath = `/dashboard/events/${slug}/income-records`;

    return (
      <div className="flex flex-col gap-6 pb-8">
        {/* HERO SECTION */}
        <section className="workspace-intro">



          <div className="relative z-10 flex flex-col gap-6 max-w-3xl">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="success" className="px-3 py-1 font-semibold border-success/30 bg-success/10 text-success">
                <Wallet className="w-3 h-3 mr-1.5 inline-block" />
                Revenue Ledger
              </Badge>
              <Badge variant="info" className="px-3 py-1 font-semibold border-info/30 bg-info/10 text-info">
                {event.title}
              </Badge>
            </div>

            <h1 className="text-3xl font-semibold leading-tight tracking-tight text-foreground lg:text-4xl">
              Income <span className="text-success">Records</span>
            </h1>

            <p className="text-muted-foreground text-lg leading-relaxed font-normal">
              Register and verify supplementary revenue streams — sponsorships, donations, institutional grants, and other authorized income sources for this event.
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Badge variant="neutral" className="bg-panel border-border/50 text-sm py-1.5">
                <TrendingUp className="w-4 h-4 mr-2 inline-block text-success" />
                {incomeRecords.length} Registered entries
              </Badge>
            </div>
          </div>
        </section>

        {/* FILTERS */}
        <FilterCard resetHref={basePath}>
          <Field label="Search records">
            <Input
              name="search"
              defaultValue={search ?? ""}
              placeholder="Search by source label or type..."
            />
          </Field>
        </FilterCard>

        {/* WORKSPACE AREA */}
        <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_360px] items-start">

          {/* LEDGER TABLE */}
          <Card className="border-border/40 shadow-panel bg-panel overflow-hidden flex flex-col h-full">
            <CardHeader className="border-b border-border/30 bg-muted/10 pb-5">
              <CardTitle className="text-xl tracking-tight">Revenue Entries</CardTitle>
              <CardDescription>Select an entry to review its supporting documents and verification status.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {incomeRecords.length === 0 ? (
                <div className="p-12">
                  <StatePanel
                    icon={SearchSlash}
                    title="No Matching Records"
                    description="No income entries match the current filter criteria. Use the form below to register a new supplementary income record."
                    tone="empty"
                  />
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="font-semibold text-muted-foreground tracking-wider uppercase text-xs h-12 px-6">Source</TableHead>
                      <TableHead className="font-semibold text-muted-foreground tracking-wider uppercase text-xs h-12 text-right">Amount</TableHead>
                      <TableHead className="font-semibold text-muted-foreground tracking-wider uppercase text-xs h-12 text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {incomeRecords.map((record) => {
                      const isSelected = record.id === selectedIncomeRecordId;
                      return (
                        <TableRow
                          key={record.id}
                          className={`transition-colors ${isSelected ? "bg-primary/5 hover:bg-primary/10 border-l-2 border-l-primary" : "hover:bg-muted/30 border-l-2 border-l-transparent"}`}
                        >
                          <TableCell className="align-top px-6 py-4">
                            <Link
                              href={`${buildRelativeHref(basePath, sParams, { incomeRecordId: record.id })}#details-panel`}
                              className={`font-bold transition-colors ${isSelected ? "text-primary" : "text-foreground hover:text-primary"}`}
                              aria-current={isSelected ? "page" : undefined}
                            >
                              {record.sourceLabel}
                            </Link>
                            <div className="mt-1 font-mono text-[11px] text-muted-foreground tracking-widest bg-muted/50 w-fit px-1.5 py-0.5 rounded">
                              {formatEnumLabel(record.sourceType)}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold">
                            {formatMoney(record.amount)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={getIncomeStateTone(record.state)} className="text-xs px-2 py-0.5">
                              {formatEnumLabel(record.state)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* INSPECTION PANEL */}
          <div id="details-panel" className="space-y-6">
            {selectedIncome ? (
              <div key={selectedIncome.id} className="space-y-6">

                {/* INCOME DETAIL CARD */}
                <Card className="border-primary/20 shadow-panel bg-panel relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none">
                    <Wallet className="w-40 h-40" />
                  </div>
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={getIncomeStateTone(selectedIncome.state)} className="text-xs px-2 py-1 shadow-sm">
                        {formatEnumLabel(selectedIncome.state)}
                      </Badge>
                      <Badge variant="neutral" className="text-xs px-2 py-1">
                        {formatEnumLabel(selectedIncome.sourceType)}
                      </Badge>
                    </div>
                    <CardTitle className="text-2xl tracking-tight">Revenue Detail</CardTitle>
                    <CardDescription className="text-primary/80 font-medium">
                      {selectedIncome.event.title}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-5">
                    <div className="rounded-xl border border-border/50 bg-panel p-5 shadow-sm">
                      <div className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-3">
                        <Tag className="h-3 w-3" /> Source Identification
                      </div>
                      <div className="text-lg font-semibold text-foreground">
                        {selectedIncome.sourceLabel}
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-border/50 bg-panel p-4 shadow-sm">
                        <div className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-2">
                          <Wallet className="h-3 w-3" /> Amount Received
                        </div>
                        <div className="text-2xl font-semibold text-success tracking-tight">
                          {formatMoney(selectedIncome.amount)}
                        </div>
                      </div>
                      <div className="rounded-xl border border-border/50 bg-panel p-4 shadow-sm">
                        <div className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-2">
                          <CalendarDays className="h-3 w-3" /> Collection Date
                        </div>
                        <div className="font-mono text-sm text-foreground mt-3">
                          {formatDate(selectedIncome.collectedAt)}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-border/50 bg-panel p-4 shadow-sm">
                      <div className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-2">
                        <FileText className="h-3 w-3" /> Reference Notes
                      </div>
                      <div className="text-sm font-normal leading-relaxed text-foreground mt-2">
                        {selectedIncome.referenceText ?? <span className="italic text-muted-foreground">No supplementary reference provided.</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground bg-muted/30 rounded-lg px-4 py-3">
                      <span className="font-medium">Recorded {formatDateTime(selectedIncome.createdAt)}</span>
                      {selectedIncome.verifiedBy && (
                        <>
                          <span className="text-border">•</span>
                          <span>Verified by <span className="font-semibold text-foreground">{selectedIncome.verifiedBy.fullName}</span></span>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <SupportingDocumentList
                  documents={selectedIncome.documents}
                  title="Supporting documents"
                  emptyMessage="This income record does not yet have an attached evidence file."
                />
                {canManageIncomeRecords ? (
                  <IncomeRecordStatePanel key={selectedIncome.id}
                    incomeRecordId={selectedIncome.id}
                    allowVerify={selectedIncome.state === "RECORDED"}
                    allowVoid={selectedIncome.state !== "REJECTED"}
                  />
                ) : (
                  <Card className="border-border/40 bg-panel shadow-panel relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-[0.03] pointer-events-none">
                      <ShieldAlert className="w-24 h-24" />
                    </div>
                    <CardHeader>
                      <Badge variant="warning" className="w-fit mb-3 text-xs px-2 py-1">Restricted</Badge>
                      <CardTitle className="text-xl tracking-tight">Read-only overview</CardTitle>
                      <CardDescription className="text-muted-foreground leading-relaxed">
                        Your current role permits inspection of income history, but verifications require Finance Controller privileges.
                      </CardDescription>
                    </CardHeader>
                  </Card>
                )}
              </div>
            ) : null}
            {canManageIncomeRecords ? <IncomeRecordForm events={eventsArray} /> : null}
          </div>
        </div>
      <ListPagination pagination={incomeRecords.pagination} />
        </div>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      return (
        <div className="pt-12">
          <StatePanel
            icon={ShieldAlert}
            title="Access restricted"
            description="Income record management is restricted to authenticated Finance Controllers and System Administrators."
            tone="warning"
          />
        </div>
      );
    }

    return (
      <div className="pt-12">
        <StatePanel
          icon={AlertTriangle}
          title="Unable to load this page"
          description={
            error instanceof ApiError
              ? error.message
              : "An unexpected error disrupted the connection to the income ledger core."
          }
          tone="error"
        />
      </div>
    );
  }
}
