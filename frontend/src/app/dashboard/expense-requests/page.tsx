import Link from "next/link";
import { AlertTriangle, SearchSlash, ShieldAlert, Receipt, CheckCircle2, CalendarDays, FileText, Tag, TrendingDown } from "lucide-react";

import { getCurrentUser } from "@/lib/api/student";
import { hasAnyRole } from "@/lib/access";
import {
  getExpenseRequest,
  listExpenseRequests,
  listInternalEventOptions,
} from "@/lib/api/internal";
import { buildRelativeHref } from "@/lib/detail-query";
import { ApiError } from "@/lib/api/shared";
import {
  formatDateTime,
  formatEnumLabel,
  formatMoney,
  getExpenseRecordStateTone,
  getRequestStateTone,
} from "@/lib/format";
import { ExpenseRequestForm, SubmitRequestButton } from "@/components/internal/requests-actions";
import { DecisionHistoryCard } from "@/components/internal/decision-history-card";
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

export default async function ExpenseRequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const eventId = typeof params.eventId === "string" ? params.eventId : undefined;
  const state = typeof params.state === "string" ? params.state : undefined;
  const expenseRequestId =
    typeof params.expenseRequestId === "string" ? params.expenseRequestId : undefined;

  try {
    const user = await getCurrentUser();
    const canSubmitRequests = hasAnyRole(user, ["SYSTEM_ADMIN", "EVENT_MANAGEMENT_USER"]);
    const [expenseRequests, events] = await Promise.all([
      listExpenseRequests({ eventId, state }),
      listInternalEventOptions(),
    ]);
    const selectedExpenseRequestId =
      expenseRequests.find((request) => request.id === expenseRequestId)?.id ?? expenseRequests[0]?.id;
    const selectedRequest = selectedExpenseRequestId
      ? await getExpenseRequest(selectedExpenseRequestId)
      : null;

    const approvedCount = expenseRequests.filter((r) => r.state === "APPROVED").length;
    const pendingCount = expenseRequests.filter((r) => r.state === "SUBMITTED" || r.state === "PENDING_REVIEW").length;

    return (
      <div className="flex flex-col gap-8 pb-16">
        {/* HERO SECTION */}
        <section className="relative overflow-hidden rounded-3xl border border-border/20 bg-background/50 shadow-2xl shadow-black/5 backdrop-blur-3xl px-8 py-10 lg:px-12 lg:py-12">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
          <div className="absolute bottom-0 right-0 -z-10 m-auto h-[300px] w-[300px] rounded-full bg-danger/8 opacity-60 blur-[100px] pointer-events-none translate-x-1/4 translate-y-1/4" />
          
          <div className="relative z-10 flex flex-col gap-6 max-w-3xl">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="danger" className="px-3 py-1 font-semibold tracking-wider uppercase border-danger/30 bg-danger/10 text-danger backdrop-blur-md">
                <Receipt className="w-3 h-3 mr-1.5 inline-block" />
                Expenditure Pipeline
              </Badge>
            </div>
            
            <h1 className="text-3xl lg:text-5xl font-black tracking-tight text-foreground">
              Expense <span className="text-transparent bg-clip-text bg-gradient-to-br from-danger via-danger/80 to-danger/50">Requests</span>
            </h1>
            
            <p className="text-muted-foreground text-lg leading-relaxed font-light">
              Initiate, justify, and route expenditure proposals through the multi-tier approval pipeline. Approved requests become the basis for settled expense records in the financial ledger.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Badge variant="neutral" className="bg-background/50 backdrop-blur-sm border-border/50 text-sm py-1.5">
                <TrendingDown className="w-4 h-4 mr-2 inline-block text-danger" />
                {expenseRequests.length} Request(s)
              </Badge>
              {approvedCount > 0 && (
                <Badge variant="success" className="text-sm py-1.5 border-success/30 bg-success/10">
                  <CheckCircle2 className="w-4 h-4 mr-2 inline-block" />
                  {approvedCount} Approved
                </Badge>
              )}
              {pendingCount > 0 && (
                <Badge variant="warning" className="text-sm py-1.5 border-warning/30 bg-warning/10">
                  {pendingCount} Awaiting Decision
                </Badge>
              )}
            </div>
          </div>
        </section>

        {/* FILTERS */}
        <FilterCard resetHref="/dashboard/expense-requests">
          <Field label="Target Initiative">
            <Select
              name="eventId"
              defaultValue={eventId ?? ""}
              options={[
                { value: "", label: "All Initiatives" },
                ...events.map((event) => ({
                  value: event.id,
                  label: event.title,
                })),
              ]}
            />
          </Field>
          <Field label="Pipeline Stage">
            <Select
              name="state"
              defaultValue={state ?? ""}
              options={[
                { value: "", label: "All Stages" },
                { value: "DRAFT", label: "Draft" },
                { value: "SUBMITTED", label: "Submitted" },
                { value: "PENDING_REVIEW", label: "Pending Review" },
                { value: "APPROVED", label: "Approved" },
                { value: "RETURNED", label: "Returned" },
                { value: "REJECTED", label: "Rejected" },
              ]}
            />
          </Field>
        </FilterCard>

        {/* WORKSPACE */}
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.2fr)_460px] items-start">
          
          {/* REQUEST QUEUE TABLE */}
          <Card className="border-border/40 shadow-xl shadow-black/5 bg-background/40 backdrop-blur-xl overflow-hidden flex flex-col h-full">
            <CardHeader className="border-b border-border/30 bg-muted/10 pb-5">
              <CardTitle className="text-xl tracking-tight">Expenditure Queue</CardTitle>
              <CardDescription>Select a request to review its justification, linked settlements, and approval history.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {expenseRequests.length === 0 ? (
                <div className="p-12">
                  <StatePanel
                    icon={SearchSlash}
                    title="No Matching Requests"
                    description="No expense requests match the current filter criteria. Use the form below to initiate a new expenditure proposal."
                    tone="empty"
                  />
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="font-semibold text-muted-foreground tracking-wider uppercase text-xs h-12 px-6">Purpose</TableHead>
                      <TableHead className="font-semibold text-muted-foreground tracking-wider uppercase text-xs h-12">Category</TableHead>
                      <TableHead className="font-semibold text-muted-foreground tracking-wider uppercase text-xs h-12 text-right">Amount</TableHead>
                      <TableHead className="font-semibold text-muted-foreground tracking-wider uppercase text-xs h-12 text-center">Stage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenseRequests.map((request) => {
                      const isSelected = request.id === selectedExpenseRequestId;
                      return (
                        <TableRow
                          key={request.id}
                          className={`transition-colors ${isSelected ? "bg-primary/5 hover:bg-primary/10 border-l-2 border-l-primary" : "hover:bg-muted/30 border-l-2 border-l-transparent"}`}
                        >
                          <TableCell className="align-top px-6 py-4">
                            <Link
                              href={`${buildRelativeHref("/dashboard/expense-requests", params, { expenseRequestId: request.id })}#details-panel`}
                              className={`font-bold transition-colors ${isSelected ? "text-primary" : "text-foreground hover:text-primary"}`}
                              aria-current={isSelected ? "page" : undefined}
                            >
                              {request.purpose}
                            </Link>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {request.event.title}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-[11px] text-muted-foreground tracking-widest bg-muted/50 px-1.5 py-0.5 rounded">
                              {request.category}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold">
                            {formatMoney(request.amount)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={getRequestStateTone(request.state)} className="text-[10px] uppercase tracking-widest px-2 py-0.5">
                              {formatEnumLabel(request.state)}
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
            {selectedRequest ? (
              <div key={selectedRequest.id} className="space-y-6">
                
                {/* REQUEST DETAIL CARD */}
                <Card className="border-primary/20 shadow-xl shadow-primary/5 bg-background/50 backdrop-blur-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none">
                    <Receipt className="w-40 h-40" />
                  </div>
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Badge variant={getRequestStateTone(selectedRequest.state)} className="text-xs uppercase tracking-widest px-2 py-1 shadow-sm">
                        {formatEnumLabel(selectedRequest.state)}
                      </Badge>
                      <Badge variant="neutral" className="text-xs uppercase tracking-widest px-2 py-1">
                        {selectedRequest.category}
                      </Badge>
                    </div>
                    <CardTitle className="text-2xl tracking-tight">Request Detail</CardTitle>
                    <CardDescription className="text-primary/80 font-medium">
                      {selectedRequest.event.title}
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent className="space-y-5">
                    {/* PURPOSE & JUSTIFICATION */}
                    <div className="rounded-xl border border-border/50 bg-background/80 p-5 shadow-sm">
                      <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-3">
                        <FileText className="h-3 w-3" /> Purpose & Justification
                      </div>
                      <div className="text-base font-bold text-foreground">
                        {selectedRequest.purpose}
                      </div>
                      <div className="mt-3 text-sm leading-relaxed text-muted-foreground font-light">
                        {selectedRequest.justification ?? <span className="italic">No additional justification provided.</span>}
                      </div>
                    </div>

                    {/* AMOUNT & DATE */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-danger/20 bg-danger/5 p-4 shadow-sm">
                        <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-danger/80 mb-2">
                          <TrendingDown className="h-3 w-3" /> Requested Amount
                        </div>
                        <div className="text-2xl font-black text-danger tracking-tight">
                          {formatMoney(selectedRequest.amount)}
                        </div>
                      </div>
                      <div className="rounded-xl border border-border/50 bg-background/80 p-4 shadow-sm">
                        <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-2">
                          <CalendarDays className="h-3 w-3" /> Filed On
                        </div>
                        <div className="font-mono text-sm text-foreground mt-3">
                          {formatDateTime(selectedRequest.createdAt)}
                        </div>
                      </div>
                    </div>

                    {/* LINKED EXPENSE RECORDS */}
                    {selectedRequest.expenseRecords.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-4">
                          <Tag className="h-3 w-3" /> Linked Settlements ({selectedRequest.expenseRecords.length})
                        </div>
                        <div className="space-y-3">
                          {selectedRequest.expenseRecords.map((record) => (
                            <div
                              key={record.id}
                              className="rounded-xl border border-border/50 bg-background/80 p-4 shadow-sm hover:bg-muted/20 transition-colors"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="font-bold text-foreground text-sm">{record.category}</div>
                                <Badge variant={getExpenseRecordStateTone(record.state)} className="text-[10px] uppercase tracking-widest px-2 py-0.5">
                                  {formatEnumLabel(record.state)}
                                </Badge>
                              </div>
                              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                                <span className="font-mono font-bold text-foreground">{formatMoney(record.amount)}</span>
                                <span className="text-border">•</span>
                                <span>{formatDateTime(record.createdAt)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <SupportingDocumentList documents={selectedRequest.documents} />
                <DecisionHistoryCard decisions={selectedRequest.approvalDecisions} />
                
                {canSubmitRequests &&
                (selectedRequest.state === "DRAFT" || selectedRequest.state === "RETURNED") ? (
                  <SubmitRequestButton
                    endpoint={`/requests/expense-requests/${selectedRequest.id}/submit`}
                    label="Expense request"
                  />
                ) : !canSubmitRequests ? (
                  <Card className="border-border/40 bg-background/50 backdrop-blur-xl shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-[0.03] pointer-events-none">
                      <ShieldAlert className="w-24 h-24" />
                    </div>
                    <CardHeader>
                      <Badge variant="warning" className="w-fit mb-3 text-xs uppercase tracking-widest px-2 py-1">Restricted</Badge>
                      <CardTitle className="text-xl tracking-tight">Observer Mode</CardTitle>
                      <CardDescription className="text-muted-foreground leading-relaxed">
                        Your current role permits inspection of expenditure history and linked settlements, but request creation and submission require Event Management privileges.
                      </CardDescription>
                    </CardHeader>
                  </Card>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {canSubmitRequests ? <ExpenseRequestForm events={events} /> : null}
      </div>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      return (
        <div className="pt-12">
          <StatePanel
            icon={ShieldAlert}
            title="Unauthorized Clearance Level"
            description="Expense request management is restricted to authorized internal operational roles."
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
              : "An unexpected error disrupted the connection to the expenditure pipeline."
          }
          tone="error"
        />
      </div>
    );
  }
}
