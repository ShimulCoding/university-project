import type { BudgetRecord, ExpenseRequestRecord } from "@/types";
import { ListPagination } from "@/components/ui/list-pagination";
import { queryPage, apiOptions } from "@/lib/api/list";
import Link from "next/link";
import { AlertTriangle, SearchSlash, ShieldAlert, CreditCard, CalendarDays, FileText, TrendingDown, CheckCircle2, LinkIcon } from "lucide-react";

import {
  getExpenseRecord,
  listExpenseRecords,
  listInternalEventOptions,
} from "@/lib/api/internal";
import { buildRelativeHref } from "@/lib/detail-query";
import { ApiError } from "@/lib/api/shared";
import {
  formatDate,
  formatDateTime,
  formatEnumLabel,
  formatMoney,
  getExpenseRecordStateTone,
} from "@/lib/format";
import { ExpenseRecordForm, ExpenseRecordStatePanel } from "@/components/internal/requests-actions";
import { FilterCard } from "@/components/internal/filter-card";
import { SupportingDocumentList } from "@/components/internal/supporting-document-list";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
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

export default async function ExpenseRecordsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const eventId = typeof params.eventId === "string" ? params.eventId : undefined;
  const state = typeof params.state === "string" ? params.state : undefined;
  const expenseRecordId =
    typeof params.expenseRecordId === "string" ? params.expenseRecordId : undefined;

  try {
    const canManageExpenseRecords = false;
    const [expenseRecords, events, expenseRequests, activeBudgets] = await Promise.all([
      listExpenseRecords({ page: queryPage(params.page), eventId, state }),
      listInternalEventOptions(),
      apiOptions<ExpenseRequestRecord>("/requests/expense-requests", "expenseRequests", { state: "APPROVED" }),
      apiOptions<BudgetRecord>("/budgets", "budgets", { state: "APPROVED", isActive: "true" }),
    ]);
    const selectedExpenseRecordId =
      expenseRecords.find((record) => record.id === expenseRecordId)?.id ?? expenseRecords[0]?.id;
    const selectedRecord = selectedExpenseRecordId
      ? await getExpenseRecord(selectedExpenseRecordId)
      : null;

    const settledCount = expenseRecords.filter((r) => r.state === "SETTLED").length;
    const recordedCount = expenseRecords.filter((r) => r.state === "RECORDED").length;

    return (
      <div className="flex flex-col gap-6 pb-8">
        {/* HERO SECTION */}
        <section className="workspace-intro">



          <div className="relative z-10 flex flex-col gap-6 max-w-3xl">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="warning" className="px-3 py-1 font-semibold border-warning/30 bg-warning/10 text-warning">
                <CreditCard className="w-3 h-3 mr-1.5 inline-block" />
                Settlement Ledger
              </Badge>
              <Badge variant="info" className="px-3 py-1 font-semibold border-info/30 bg-info/10 text-info">
                Finance Authorized
              </Badge>
            </div>

            <h1 className="text-3xl font-semibold leading-tight tracking-tight text-foreground lg:text-4xl">
              Expense <span className="text-success">Records</span>
            </h1>

            <p className="text-muted-foreground text-lg leading-relaxed font-normal">
              Record, settle, and audit actual expenditures against approved requests. Each record feeds directly into the reconciliation engine for public financial disclosure.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Badge variant="neutral" className="bg-panel border-border/50 text-sm py-1.5">
                <TrendingDown className="w-4 h-4 mr-2 inline-block text-warning" />
                {expenseRecords.length} Total entries
              </Badge>
              {settledCount > 0 && (
                <Badge variant="success" className="text-sm py-1.5 border-success/30 bg-success/10">
                  <CheckCircle2 className="w-4 h-4 mr-2 inline-block" />
                  {settledCount} Settled
                </Badge>
              )}
              {recordedCount > 0 && (
                <Badge variant="warning" className="text-sm py-1.5 border-warning/30 bg-warning/10">
                  {recordedCount} Pending Settlement
                </Badge>
              )}
            </div>
          </div>
        </section>

        {/* FILTERS */}
        <FilterCard resetHref="/dashboard/expense-records">
          <Field label="Event">
            <Select
              name="eventId"
              defaultValue={eventId ?? ""}
              options={[
                { value: "", label: "All Events" },
                ...events.map((event) => ({
                  value: event.id,
                  label: event.title,
                })),
              ]}
            />
          </Field>
          <Field label="Settlement Stage">
            <Select
              name="state"
              defaultValue={state ?? ""}
              options={[
                { value: "", label: "All Stages" },
                { value: "RECORDED", label: "Recorded" },
                { value: "SETTLED", label: "Settled" },
                { value: "VOIDED", label: "Voided" },
              ]}
            />
          </Field>
        </FilterCard>

        {/* WORKSPACE */}
        <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_360px] items-start">

          {/* LEDGER TABLE */}
          <Card className="border-border/40 shadow-panel bg-panel overflow-hidden flex flex-col h-full">
            <CardHeader className="border-b border-border/30 bg-muted/10 pb-5">
              <CardTitle className="text-xl tracking-tight">Expenditure Ledger</CardTitle>
              <CardDescription>Select an entry to inspect its evidence, linked request origin, and settlement controls.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {expenseRecords.length === 0 ? (
                <div className="p-12">
                  <StatePanel
                    icon={SearchSlash}
                    title="No Matching Records"
                    description="No expense records match the current filter criteria. Use the form below to log a new expenditure entry."
                    tone="empty"
                  />
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="font-semibold text-muted-foreground tracking-wider uppercase text-xs h-12 px-6">Description</TableHead>
                      <TableHead className="font-semibold text-muted-foreground tracking-wider uppercase text-xs h-12">Event</TableHead>
                      <TableHead className="font-semibold text-muted-foreground tracking-wider uppercase text-xs h-12 text-right">Amount</TableHead>
                      <TableHead className="font-semibold text-muted-foreground tracking-wider uppercase text-xs h-12 text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenseRecords.map((record) => {
                      const isSelected = record.id === selectedExpenseRecordId;
                      return (
                        <TableRow
                          key={record.id}
                          className={`transition-colors ${isSelected ? "bg-primary/5 hover:bg-primary/10 border-l-2 border-l-primary" : "hover:bg-muted/30 border-l-2 border-l-transparent"}`}
                        >
                          <TableCell className="align-top px-6 py-4">
                            <Link
                              href={`${buildRelativeHref("/dashboard/expense-records", params, { expenseRecordId: record.id })}#details-panel`}
                              className={`font-bold transition-colors ${isSelected ? "text-primary" : "text-foreground hover:text-primary"}`}
                              aria-current={isSelected ? "page" : undefined}
                            >
                              {record.description}
                            </Link>
                            <div className="mt-1 font-mono text-[11px] text-muted-foreground tracking-widest bg-muted/50 w-fit px-1.5 py-0.5 rounded">
                              {record.category}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm font-medium">{record.event.title}</TableCell>
                          <TableCell className="text-right font-mono font-semibold">
                            {formatMoney(record.amount)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={getExpenseRecordStateTone(record.state)} className="text-xs px-2 py-0.5">
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

          {/* DETAIL PANEL */}
          <div id="details-panel" className="space-y-6">
            {selectedRecord ? (
              <div key={selectedRecord.id} className="space-y-6">

                {/* RECORD DETAIL CARD */}
                <Card className="border-primary/20 shadow-panel bg-panel relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none">
                    <CreditCard className="w-40 h-40" />
                  </div>
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Badge variant={getExpenseRecordStateTone(selectedRecord.state)} className="text-xs px-2 py-1 shadow-sm">
                        {formatEnumLabel(selectedRecord.state)}
                      </Badge>
                      <Badge variant="neutral" className="text-xs px-2 py-1">
                        {selectedRecord.category}
                      </Badge>
                    </div>
                    <CardTitle className="text-2xl tracking-tight">Expenditure Detail</CardTitle>
                    <CardDescription className="text-primary/80 font-medium">
                      {selectedRecord.event.title}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-5">
                    {/* DESCRIPTION */}
                    <div className="rounded-xl border border-border/50 bg-panel p-5 shadow-sm">
                      <div className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-3">
                        <FileText className="h-3 w-3" /> Expenditure Description
                      </div>
                      <div className="text-base font-semibold text-foreground">
                        {selectedRecord.description}
                      </div>
                    </div>

                    {/* AMOUNT & DATE */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-warning/20 bg-warning/5 p-4 shadow-sm">
                        <div className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-warning mb-2">
                          <TrendingDown className="h-3 w-3" /> Disbursed Amount
                        </div>
                        <div className="text-2xl font-semibold text-warning tracking-tight">
                          {formatMoney(selectedRecord.amount)}
                        </div>
                      </div>
                      <div className="rounded-xl border border-border/50 bg-panel p-4 shadow-sm">
                        <div className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-2">
                          <CalendarDays className="h-3 w-3" /> Payment Date
                        </div>
                        <div className="font-mono text-sm text-foreground mt-3">
                          {formatDate(selectedRecord.paidAt)}
                        </div>
                      </div>
                    </div>

                    {/* LINKED REQUEST */}
                    {selectedRecord.expenseRequest && (
                      <div className="rounded-xl border border-info/20 bg-info/5 p-4 shadow-sm">
                        <div className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-info mb-3">
                          <LinkIcon className="h-3 w-3" /> Linked Expense Request
                        </div>
                        <div className="font-semibold text-foreground">
                          {selectedRecord.expenseRequest.purpose}
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-mono font-semibold text-foreground">{formatMoney(selectedRecord.expenseRequest.amount)}</span>
                          <span className="text-border">•</span>
                          <span>{formatEnumLabel(selectedRecord.expenseRequest.state)}</span>
                        </div>
                      </div>
                    )}

                    {/* AUDIT FOOTER */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground bg-muted/30 rounded-lg px-4 py-3">
                      <span className="font-medium">Recorded by <span className="font-semibold text-foreground">{selectedRecord.recordedBy?.fullName ?? "Unknown"}</span></span>
                      <span className="text-border">•</span>
                      <span>{formatDateTime(selectedRecord.createdAt)}</span>
                    </div>
                  </CardContent>
                </Card>

                <SupportingDocumentList documents={selectedRecord.documents} />
                {canManageExpenseRecords ? (
                  <ExpenseRecordStatePanel key={selectedRecord.id}
                    expenseRecordId={selectedRecord.id}
                    allowSettle={selectedRecord.state === "RECORDED"}
                    allowVoid={selectedRecord.state !== "VOIDED"}
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
                        Your current role permits inspection of expenditure history, but settlement and voiding operations require Finance Controller or System Administrator privileges.
                      </CardDescription>
                    </CardHeader>
                  </Card>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {canManageExpenseRecords ? (
          <ExpenseRecordForm events={events} expenseRequests={expenseRequests} budgets={activeBudgets} />
        ) : null}
      <ListPagination pagination={expenseRecords.pagination} />
        </div>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      return (
        <div className="pt-12">
          <StatePanel
            icon={ShieldAlert}
            title="Access restricted"
            description="Expense record management is restricted to authenticated Finance Controllers and System Administrators."
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
              : "An unexpected error disrupted the connection to the settlement ledger."
          }
          tone="error"
        />
      </div>
    );
  }
}
