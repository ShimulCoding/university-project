import Link from "next/link";
import { AlertTriangle, SearchSlash, ShieldAlert, Wallet, CalendarDays, Tag, FileText, TrendingUp } from "lucide-react";

import {
  getIncomeRecord,
  listIncomeRecords,
  listInternalEventOptions,
} from "@/lib/api/internal";
import { buildRelativeHref } from "@/lib/detail-query";
import { ApiError } from "@/lib/api/shared";
import {
  formatDate,
  formatDateTime,
  formatEnumLabel,
  formatMoney,
  getIncomeStateTone,
} from "@/lib/format";
import { IncomeRecordForm, IncomeRecordStatePanel } from "@/components/internal/payments-actions";
import { FilterCard } from "@/components/internal/filter-card";
import { SupportingDocumentList } from "@/components/internal/supporting-document-list";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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

export default async function IncomeRecordsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const eventId = typeof params.eventId === "string" ? params.eventId : undefined;
  const search = typeof params.search === "string" ? params.search : undefined;
  const incomeRecordId =
    typeof params.incomeRecordId === "string" ? params.incomeRecordId : undefined;

  try {
    const [incomeRecords, events] = await Promise.all([
      listIncomeRecords({ eventId, search }),
      listInternalEventOptions(),
    ]);

    const selectedIncomeRecordId =
      incomeRecords.find((record) => record.id === incomeRecordId)?.id ?? incomeRecords[0]?.id;
    const selectedIncome = selectedIncomeRecordId
      ? await getIncomeRecord(selectedIncomeRecordId)
      : null;

    return (
      <div className="flex flex-col gap-8 pb-16">
        {/* HERO SECTION */}
        <section className="relative overflow-hidden rounded-3xl border border-border/20 bg-background/50 shadow-2xl shadow-black/5 backdrop-blur-3xl px-8 py-10 lg:px-12 lg:py-12">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
          <div className="absolute top-0 right-0 -z-10 m-auto h-[300px] w-[300px] rounded-full bg-success/10 opacity-60 blur-[100px] pointer-events-none translate-x-1/4 -translate-y-1/4" />
          
          <div className="relative z-10 flex flex-col gap-6 max-w-3xl">
            <div className="flex items-center gap-3">
              <Badge variant="success" className="px-3 py-1 font-semibold tracking-wider uppercase border-success/30 bg-success/10 text-success backdrop-blur-md">
                <Wallet className="w-3 h-3 mr-1.5 inline-block" />
                Revenue Ledger
              </Badge>
              <Badge variant="info" className="px-3 py-1 font-semibold tracking-wider uppercase border-info/30 bg-info/10 text-info backdrop-blur-md">
                Finance Authorized
              </Badge>
            </div>
            
            <h1 className="text-3xl lg:text-5xl font-black tracking-tight text-foreground">
              Income <span className="text-transparent bg-clip-text bg-gradient-to-br from-success via-success/80 to-success/50">Records</span>
            </h1>
            
            <p className="text-muted-foreground text-lg leading-relaxed font-light">
              Register and verify supplementary revenue streams — sponsorships, donations, institutional grants, and other authorized income sources. Each entry is event-linked and evidence-backed.
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Badge variant="neutral" className="bg-background/50 backdrop-blur-sm border-border/50 text-sm py-1.5">
                <TrendingUp className="w-4 h-4 mr-2 inline-block text-success" />
                {incomeRecords.length} Registered entries
              </Badge>
            </div>
          </div>
        </section>

        {/* FILTERS */}
        <FilterCard resetHref="/dashboard/income-records">
          <Field label="Target Initiative">
            <Select
              name="eventId"
              defaultValue={eventId ?? ""}
              options={[
                { value: "", label: "All Active Initiatives" },
                ...events.map((event) => ({
                  value: event.id,
                  label: event.title,
                })),
              ]}
            />
          </Field>
          <Field label="Query Record">
            <Input
              name="search"
              defaultValue={search ?? ""}
              placeholder="Search by source label, type, or event name..."
            />
          </Field>
        </FilterCard>

        {/* WORKSPACE AREA */}
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.2fr)_450px] items-start">
          
          {/* LEDGER TABLE */}
          <Card className="border-border/40 shadow-xl shadow-black/5 bg-background/40 backdrop-blur-xl overflow-hidden flex flex-col h-full">
            <CardHeader className="border-b border-border/30 bg-muted/10 pb-5">
              <CardTitle className="text-xl tracking-tight">Revenue Entries</CardTitle>
              <CardDescription>Select an entry to inspect its evidence files, verify authenticity, or manage its lifecycle state.</CardDescription>
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
                      <TableHead className="font-semibold text-muted-foreground tracking-wider uppercase text-xs h-12">Initiative</TableHead>
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
                              href={`${buildRelativeHref("/dashboard/income-records", params, { incomeRecordId: record.id })}#details-panel`}
                              className={`font-bold transition-colors ${isSelected ? "text-primary" : "text-foreground hover:text-primary"}`}
                              aria-current={isSelected ? "page" : undefined}
                            >
                              {record.sourceLabel}
                            </Link>
                            <div className="mt-1 font-mono text-[11px] text-muted-foreground tracking-widest bg-muted/50 w-fit px-1.5 py-0.5 rounded">
                              {formatEnumLabel(record.sourceType)}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm font-medium">{record.event.title}</TableCell>
                          <TableCell className="text-right font-mono font-bold">
                            {formatMoney(record.amount)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={getIncomeStateTone(record.state)} className="text-[10px] uppercase tracking-widest px-2 py-0.5">
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
                <Card className="border-primary/20 shadow-xl shadow-primary/5 bg-background/50 backdrop-blur-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none">
                    <Wallet className="w-40 h-40" />
                  </div>
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={getIncomeStateTone(selectedIncome.state)} className="text-xs uppercase tracking-widest px-2 py-1 shadow-sm">
                        {formatEnumLabel(selectedIncome.state)}
                      </Badge>
                      <Badge variant="neutral" className="text-xs uppercase tracking-widest px-2 py-1">
                        {formatEnumLabel(selectedIncome.sourceType)}
                      </Badge>
                    </div>
                    <CardTitle className="text-2xl tracking-tight">Revenue Detail</CardTitle>
                    <CardDescription className="text-primary/80 font-medium">
                      {selectedIncome.event.title}
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent className="space-y-5">
                    <div className="rounded-xl border border-border/50 bg-background/80 p-5 shadow-sm">
                      <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-3">
                        <Tag className="h-3 w-3" /> Source Identification
                      </div>
                      <div className="text-lg font-bold text-foreground">
                        {selectedIncome.sourceLabel}
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-border/50 bg-background/80 p-4 shadow-sm">
                        <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-2">
                          <Wallet className="h-3 w-3" /> Amount Received
                        </div>
                        <div className="text-2xl font-black text-success tracking-tight">
                          {formatMoney(selectedIncome.amount)}
                        </div>
                      </div>
                      <div className="rounded-xl border border-border/50 bg-background/80 p-4 shadow-sm">
                        <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-2">
                          <CalendarDays className="h-3 w-3" /> Collection Date
                        </div>
                        <div className="font-mono text-sm text-foreground mt-3">
                          {formatDate(selectedIncome.collectedAt)}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-border/50 bg-background/80 p-4 shadow-sm">
                      <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-2">
                        <FileText className="h-3 w-3" /> Reference Notes
                      </div>
                      <div className="text-sm font-light leading-relaxed text-foreground mt-2">
                        {selectedIncome.referenceText ?? <span className="italic text-muted-foreground">No supplementary reference provided.</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground bg-muted/30 rounded-lg px-4 py-3">
                      <span className="font-medium">Recorded {formatDateTime(selectedIncome.createdAt)}</span>
                      {selectedIncome.verifiedBy && (
                        <>
                          <span className="text-border">•</span>
                          <span>Verified by <span className="font-bold text-foreground">{selectedIncome.verifiedBy.fullName}</span></span>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <SupportingDocumentList
                  documents={selectedIncome.documents}
                  title="Cryptographic Evidences"
                  emptyMessage="This income record does not yet have an attached evidence file."
                />
                <IncomeRecordStatePanel
                  incomeRecordId={selectedIncome.id}
                  allowVerify={selectedIncome.state === "RECORDED"}
                  allowVoid={selectedIncome.state !== "REJECTED"}
                />
              </div>
            ) : null}
            <IncomeRecordForm events={events} />
          </div>
        </div>
      </div>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      return (
        <div className="pt-12">
          <StatePanel
            icon={ShieldAlert}
            title="Unauthorized Clearance Level"
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
          title="System Sync Error"
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
