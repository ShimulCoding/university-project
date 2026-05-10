import Link from "next/link";
import { AlertTriangle, SearchSlash, ShieldAlert, CheckSquare, ClipboardCheck, Clock, FileText, Tag, Banknote } from "lucide-react";

import {
  getBudgetRequest,
  getExpenseRequest,
  listInternalEventOptions,
  listApprovalQueue,
} from "@/lib/api/internal";
import { buildRelativeHref } from "@/lib/detail-query";
import { ApiError } from "@/lib/api/shared";
import {
  formatDateTime,
  formatEnumLabel,
  formatMoney,
  getRequestStateTone,
} from "@/lib/format";
import { ApprovalDecisionForm } from "@/components/internal/approvals-actions";
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

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const eventId = typeof params.eventId === "string" ? params.eventId : undefined;
  const entityType = typeof params.entityType === "string" ? params.entityType : undefined;
  const entityId = typeof params.entityId === "string" ? params.entityId : undefined;

  try {
    const [queue, events] = await Promise.all([
      listApprovalQueue({ eventId, entityType }),
      listInternalEventOptions(),
    ]);
    const selectedItem =
      queue.find((item) => item.entityId === entityId && item.entityType === entityType) ??
      queue[0] ??
      null;
    const selectedRecord = selectedItem
      ? selectedItem.entityType === "BUDGET_REQUEST"
        ? await getBudgetRequest(selectedItem.entityId)
        : await getExpenseRequest(selectedItem.entityId)
      : null;

    return (
      <div className="flex flex-col gap-8 pb-16">
        {/* HERO SECTION */}
        <section className="relative overflow-hidden rounded-3xl border border-border/20 bg-background/50 shadow-2xl shadow-black/5 backdrop-blur-3xl px-8 py-10 lg:px-12 lg:py-12">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
          <div className="absolute top-0 right-0 -z-10 m-auto h-[300px] w-[300px] rounded-full bg-primary/10 opacity-60 blur-[100px] pointer-events-none translate-x-1/4 -translate-y-1/4" />
          
          <div className="relative z-10 flex flex-col gap-6 max-w-3xl">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="info" className="px-3 py-1 font-semibold tracking-wider uppercase border-primary/30 bg-primary/10 text-primary backdrop-blur-md">
                <CheckSquare className="w-3 h-3 mr-1.5 inline-block" />
                Cross-Tier Authorization
              </Badge>
              <Badge variant="info" className="px-3 py-1 font-semibold tracking-wider uppercase border-info/30 bg-info/10 text-info backdrop-blur-md">
                Approver Tier
              </Badge>
            </div>
            
            <h1 className="text-3xl lg:text-5xl font-black tracking-tight text-foreground">
              Approval <span className="text-transparent bg-clip-text bg-gradient-to-br from-primary via-primary/80 to-primary/50">Decisions</span>
            </h1>
            
            <p className="text-muted-foreground text-lg leading-relaxed font-light">
              Review and execute explicit, cryptographically bound decisions on pending budgets and expenditure proposals. 
              The system enforces strict separation of duties, ensuring no request author can self-authorize.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Badge variant="warning" className="bg-background/50 backdrop-blur-sm border-warning/50 text-sm py-1.5 text-warning">
                <Clock className="w-4 h-4 mr-2 inline-block" />
                {queue.length} Queued Decision(s)
              </Badge>
            </div>
          </div>
        </section>

        {/* FILTERS */}
        <FilterCard resetHref="/dashboard/approvals">
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
          <Field label="Proposal Category">
            <Select
              name="entityType"
              defaultValue={entityType ?? ""}
              options={[
                { value: "", label: "All Categories" },
                { value: "BUDGET_REQUEST", label: "Budget Proposal" },
                { value: "EXPENSE_REQUEST", label: "Expenditure Proposal" },
              ]}
            />
          </Field>
        </FilterCard>

        {/* WORKSPACE */}
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.2fr)_460px] items-start">
          
          {/* DECISION QUEUE TABLE */}
          <Card className="border-border/40 shadow-xl shadow-black/5 bg-background/40 backdrop-blur-xl overflow-hidden flex flex-col h-full">
            <CardHeader className="border-b border-border/30 bg-muted/10 pb-5">
              <CardTitle className="text-xl tracking-tight">Authorization Queue</CardTitle>
              <CardDescription>Select a pending proposal to review its justification, evidence, and execute a binding decision.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {queue.length === 0 ? (
                <div className="p-12">
                  <StatePanel
                    icon={SearchSlash}
                    title="Queue Empty"
                    description="No proposals are currently awaiting your authorization."
                    tone="empty"
                  />
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="font-semibold text-muted-foreground tracking-wider uppercase text-xs h-12 px-6">Proposal</TableHead>
                      <TableHead className="font-semibold text-muted-foreground tracking-wider uppercase text-xs h-12">Initiative</TableHead>
                      <TableHead className="font-semibold text-muted-foreground tracking-wider uppercase text-xs h-12 text-right">Amount</TableHead>
                      <TableHead className="font-semibold text-muted-foreground tracking-wider uppercase text-xs h-12 text-center">Stage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {queue.map((item) => {
                      const isSelected = item.entityId === selectedItem?.entityId && item.entityType === selectedItem?.entityType;
                      return (
                        <TableRow
                          key={`${item.entityType}-${item.entityId}`}
                          className={`transition-colors ${isSelected ? "bg-primary/5 hover:bg-primary/10 border-l-2 border-l-primary" : "hover:bg-muted/30 border-l-2 border-l-transparent"}`}
                        >
                          <TableCell className="align-top px-6 py-4">
                            <Link
                              href={`${buildRelativeHref("/dashboard/approvals", params, {
                                entityType: item.entityType,
                                entityId: item.entityId,
                              })}#details-panel`}
                              className={`font-bold transition-colors ${isSelected ? "text-primary" : "text-foreground hover:text-primary"}`}
                              aria-current={isSelected ? "page" : undefined}
                            >
                              {formatEnumLabel(item.entityType)}
                            </Link>
                            <div className="mt-1 text-xs text-muted-foreground">
                              Requested by {item.requestedBy?.fullName ?? "Unknown"}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm font-medium">{item.event.title}</TableCell>
                          <TableCell className="text-right font-mono font-bold">
                            {formatMoney(item.amount)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={getRequestStateTone(item.state)} className="text-[10px] uppercase tracking-widest px-2 py-0.5">
                              {formatEnumLabel(item.state)}
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
            {selectedItem && selectedRecord ? (
              <div key={`${selectedItem.entityType}-${selectedItem.entityId}`} className="space-y-6">
                
                {/* PROPOSAL DETAIL CARD */}
                <Card className="border-primary/20 shadow-xl shadow-primary/5 bg-background/50 backdrop-blur-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none">
                    <ClipboardCheck className="w-40 h-40" />
                  </div>
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Badge variant={getRequestStateTone(selectedItem.state)} className="text-xs uppercase tracking-widest px-2 py-1 shadow-sm">
                        {formatEnumLabel(selectedItem.state)}
                      </Badge>
                      <Badge variant="neutral" className="text-xs uppercase tracking-widest px-2 py-1">
                        {formatEnumLabel(selectedItem.entityType)}
                      </Badge>
                    </div>
                    <CardTitle className="text-2xl tracking-tight">Proposal Inspection</CardTitle>
                    <CardDescription className="text-primary/80 font-medium">
                      {selectedItem.event.title}
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent className="space-y-5">
                    {/* EXECUTIVE SUMMARY */}
                    <div className="rounded-xl border border-border/50 bg-background/80 p-5 shadow-sm">
                      <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-3">
                        <FileText className="h-3 w-3" /> Executive Summary
                      </div>
                      <div className="text-base font-bold text-foreground">
                        {selectedItem.summary.purpose}
                      </div>
                      <div className="mt-3 text-sm leading-relaxed text-muted-foreground font-light">
                        {selectedItem.summary.justification ?? <span className="italic">No additional justification provided.</span>}
                      </div>
                    </div>

                    {/* METRICS GRID */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 shadow-sm">
                        <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-primary/80 mb-2">
                          <Banknote className="h-3 w-3" /> Total Requested
                        </div>
                        <div className="text-2xl font-black text-primary tracking-tight">
                          {formatMoney(selectedItem.amount)}
                        </div>
                      </div>
                      <div className="rounded-xl border border-border/50 bg-background/80 p-4 shadow-sm">
                        <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-2">
                          <Clock className="h-3 w-3" /> Submitted On
                        </div>
                        <div className="font-mono text-sm text-foreground mt-3">
                          {formatDateTime(selectedItem.createdAt)}
                        </div>
                      </div>
                    </div>

                    {/* AUTHOR INFO */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground bg-muted/30 rounded-lg px-4 py-3">
                      <span className="font-medium">Requested by <span className="font-bold text-foreground">{selectedItem.requestedBy?.fullName ?? "Unknown"}</span></span>
                    </div>

                  </CardContent>
                </Card>

                <SupportingDocumentList documents={selectedRecord.documents} />
                <DecisionHistoryCard decisions={selectedRecord.approvalDecisions} />
                
                {/* DECISION MATRIX */}
                <ApprovalDecisionForm item={selectedItem} />
              </div>
            ) : null}
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
            description="Access to the execution approval queue is strictly limited to authenticated Organizational Approvers and System Administrators."
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
              : "An unexpected error disrupted the connection to the authorization queue."
          }
          tone="error"
        />
      </div>
    );
  }
}
