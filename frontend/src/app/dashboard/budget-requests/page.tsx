import Link from "next/link";
import { AlertTriangle, SearchSlash, ShieldAlert, FileSpreadsheet, CheckCircle2, ArrowRight, ClipboardList, Tag } from "lucide-react";

import { getCurrentUser } from "@/lib/api/student";
import { hasAnyRole } from "@/lib/access";
import { getBudget, listBudgets, listInternalEventOptions } from "@/lib/api/internal";
import { buildRelativeHref } from "@/lib/detail-query";
import { ApiError } from "@/lib/api/shared";
import {
  formatDateTime,
  formatEnumLabel,
  formatMoney,
  getBudgetStateTone,
} from "@/lib/format";
import { BudgetComposerForm, BudgetStateForm } from "@/components/internal/budgets-actions";
import { FilterCard } from "@/components/internal/filter-card";
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

export default async function BudgetRequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const eventId = typeof params.eventId === "string" ? params.eventId : undefined;
  const state = typeof params.state === "string" ? params.state : undefined;
  const budgetId = typeof params.budgetId === "string" ? params.budgetId : undefined;

  try {
    const user = await getCurrentUser();
    const canCreateOrReviseBudgets = hasAnyRole(user, ["SYSTEM_ADMIN", "EVENT_MANAGEMENT_USER"]);
    const canApproveBudgets = hasAnyRole(user, ["SYSTEM_ADMIN", "ORGANIZATIONAL_APPROVER"]);
    const [budgets, events] = await Promise.all([
      listBudgets({ eventId, state }),
      listInternalEventOptions(),
    ]);
    const selectedBudgetId = budgets.find((budget) => budget.id === budgetId)?.id ?? budgets[0]?.id;
    const selectedBudget = selectedBudgetId ? await getBudget(selectedBudgetId) : null;

    const approvedCount = budgets.filter((b) => b.state === "APPROVED").length;
    const pendingCount = budgets.filter((b) => b.state === "SUBMITTED").length;

    return (
      <div className="flex flex-col gap-8 pb-16">
        {/* HERO SECTION */}
        <section className="relative overflow-hidden rounded-3xl border border-border/20 bg-background/50 shadow-2xl shadow-black/5 backdrop-blur-3xl px-8 py-10 lg:px-12 lg:py-12">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
          <div className="absolute top-0 left-0 -z-10 m-auto h-[300px] w-[300px] rounded-full bg-primary/10 opacity-60 blur-[100px] pointer-events-none -translate-x-1/4 -translate-y-1/4" />
          
          <div className="relative z-10 flex flex-col lg:flex-row gap-8 lg:items-center justify-between">
            <div className="space-y-5 max-w-2xl">
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant="info" className="px-3 py-1 font-semibold tracking-wider uppercase border-info/30 bg-info/10 text-info backdrop-blur-md">
                  <FileSpreadsheet className="w-3 h-3 mr-1.5 inline-block" />
                  Budget Lifecycle
                </Badge>
              </div>
              
              <h1 className="text-3xl lg:text-5xl font-black tracking-tight text-foreground">
                Budget <span className="text-transparent bg-clip-text bg-gradient-to-br from-primary via-primary/80 to-primary/50">Authorization</span>
              </h1>
              
              <p className="text-muted-foreground text-lg leading-relaxed font-light">
                Compose, submit, and review itemized event budgets. Each version is tracked through a governed draft → submission → approval pipeline until finalized.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Badge variant="neutral" className="bg-background/50 backdrop-blur-sm border-border/50 text-sm py-1.5">
                  <ClipboardList className="w-4 h-4 mr-2 inline-block text-info" />
                  {budgets.length} Version(s)
                </Badge>
                {approvedCount > 0 && (
                  <Badge variant="success" className="text-sm py-1.5 border-success/30 bg-success/10">
                    <CheckCircle2 className="w-4 h-4 mr-2 inline-block" />
                    {approvedCount} Approved
                  </Badge>
                )}
                {pendingCount > 0 && (
                  <Badge variant="warning" className="text-sm py-1.5 border-warning/30 bg-warning/10">
                    {pendingCount} Awaiting Review
                  </Badge>
                )}
              </div>
            </div>

            <Link
              href="/dashboard/budgets"
              className="flex items-center gap-3 rounded-2xl border border-primary/15 bg-background/60 backdrop-blur-md px-6 py-5 shadow-xl shadow-primary/5 hover:bg-primary/5 hover:border-primary/30 transition-all group"
            >
              <div>
                <div className="text-xs font-bold tracking-widest uppercase text-muted-foreground mb-1">Quick Access</div>
                <div className="text-base font-bold text-foreground group-hover:text-primary transition-colors">Final Budgets</div>
                <div className="text-xs text-muted-foreground font-light mt-1">View approved & active budgets</div>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </Link>
          </div>
        </section>

        {/* FILTERS */}
        <FilterCard resetHref="/dashboard/budget-requests">
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
          <Field label="Approval Stage">
            <Select
              name="state"
              defaultValue={state ?? ""}
              options={[
                { value: "", label: "All Stages" },
                { value: "DRAFT", label: "Draft" },
                { value: "SUBMITTED", label: "Submitted for Review" },
                { value: "REVISED", label: "Returned for Revision" },
                { value: "APPROVED", label: "Approved Final" },
              ]}
            />
          </Field>
        </FilterCard>

        {/* WORKSPACE */}
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.2fr)_460px] items-start">
          
          {/* VERSION QUEUE TABLE */}
          <Card className="border-border/40 shadow-xl shadow-black/5 bg-background/40 backdrop-blur-xl overflow-hidden flex flex-col h-full">
            <CardHeader className="border-b border-border/30 bg-muted/10 pb-5">
              <CardTitle className="text-xl tracking-tight">Version Queue</CardTitle>
              <CardDescription>Select a budget version to inspect its line-item composition and execute approval decisions.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {budgets.length === 0 ? (
                <div className="p-12">
                  <StatePanel
                    icon={SearchSlash}
                    title="No Matching Versions"
                    description="No budget versions match the current filter criteria. Use the composer below to draft a new itemized budget."
                    tone="empty"
                  />
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="font-semibold text-muted-foreground tracking-wider uppercase text-xs h-12 px-6">Version</TableHead>
                      <TableHead className="font-semibold text-muted-foreground tracking-wider uppercase text-xs h-12">Initiative</TableHead>
                      <TableHead className="font-semibold text-muted-foreground tracking-wider uppercase text-xs h-12 text-right">Total</TableHead>
                      <TableHead className="font-semibold text-muted-foreground tracking-wider uppercase text-xs h-12 text-center">Stage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {budgets.map((budget) => {
                      const isSelected = budget.id === selectedBudgetId;
                      return (
                        <TableRow
                          key={budget.id}
                          className={`transition-colors ${isSelected ? "bg-primary/5 hover:bg-primary/10 border-l-2 border-l-primary" : "hover:bg-muted/30 border-l-2 border-l-transparent"}`}
                        >
                          <TableCell className="align-top px-6 py-4">
                            <Link
                              href={`${buildRelativeHref("/dashboard/budget-requests", params, { budgetId: budget.id })}#details-panel`}
                              className={`font-bold transition-colors ${isSelected ? "text-primary" : "text-foreground hover:text-primary"}`}
                              aria-current={isSelected ? "page" : undefined}
                            >
                              v{budget.version}
                              {budget.title ? ` — ${budget.title}` : ""}
                            </Link>
                            <div className="mt-1 text-xs text-muted-foreground">
                              by {budget.createdBy?.fullName ?? "Unknown"}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm font-medium">{budget.event.title}</TableCell>
                          <TableCell className="text-right font-mono font-bold">
                            {budget.totalAmount ? formatMoney(budget.totalAmount) : <span className="text-muted-foreground text-xs font-sans uppercase tracking-wider">Pending</span>}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={getBudgetStateTone(budget.state)} className="text-[10px] uppercase tracking-widest px-2 py-0.5">
                              {formatEnumLabel(budget.state)}
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
            {selectedBudget ? (
              <div key={selectedBudget.id} className="space-y-6">
                
                {/* BUDGET DETAIL CARD */}
                <Card className="border-primary/20 shadow-xl shadow-primary/5 bg-background/50 backdrop-blur-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none">
                    <FileSpreadsheet className="w-40 h-40" />
                  </div>
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Badge variant={getBudgetStateTone(selectedBudget.state)} className="text-xs uppercase tracking-widest px-2 py-1 shadow-sm">
                        {formatEnumLabel(selectedBudget.state)}
                      </Badge>
                      {selectedBudget.isActive && (
                        <Badge variant="success" className="text-xs uppercase tracking-widest px-2 py-1 shadow-sm border-success/30 bg-success/10">
                          <CheckCircle2 className="w-3 h-3 mr-1" />Final Budget
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-2xl tracking-tight">
                      {selectedBudget.title ?? `Version ${selectedBudget.version}`}
                    </CardTitle>
                    <CardDescription className="text-primary/80 font-medium">
                      {selectedBudget.event.title}
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent className="space-y-5">
                    {/* TOTAL AMOUNT */}
                    <div className="rounded-xl border border-success/20 bg-success/5 p-5 shadow-sm">
                      <div className="text-[10px] font-bold tracking-widest uppercase text-success/80 mb-2">Proposed Allocation</div>
                      <div className="text-3xl font-black text-success tracking-tight">
                        {selectedBudget.totalAmount ? formatMoney(selectedBudget.totalAmount) : "Pending"}
                      </div>
                      <div className="text-xs text-muted-foreground mt-2">
                        Created {formatDateTime(selectedBudget.createdAt)}
                      </div>
                    </div>

                    {/* LINE ITEMS */}
                    <div>
                      <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-4">
                        <Tag className="h-3 w-3" /> Itemized Breakdown ({selectedBudget.items.length} line{selectedBudget.items.length !== 1 ? "s" : ""})
                      </div>
                      <div className="space-y-3">
                        {selectedBudget.items.map((item) => (
                          <div
                            key={item.id}
                            className="rounded-xl border border-border/50 bg-background/80 p-4 shadow-sm hover:bg-muted/20 transition-colors"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold text-foreground truncate">
                                  {item.label}
                                </div>
                                <div className="mt-1 font-mono text-[11px] text-muted-foreground tracking-widest bg-muted/50 w-fit px-1.5 py-0.5 rounded">
                                  {item.category}
                                </div>
                              </div>
                              <div className="text-sm font-mono font-bold text-foreground shrink-0">
                                {formatMoney(item.amount)}
                              </div>
                            </div>
                            {item.notes && (
                              <div className="mt-3 text-xs leading-relaxed text-muted-foreground font-light border-t border-border/30 pt-2">
                                {item.notes}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <BudgetStateForm
                  budget={selectedBudget}
                  canSubmit={canCreateOrReviseBudgets}
                  canApprove={canApproveBudgets}
                  canReturn={canApproveBudgets}
                />

                {canCreateOrReviseBudgets && selectedBudget.state === "REVISED" ? (
                  <BudgetComposerForm events={events} budget={selectedBudget} />
                ) : null}
              </div>
            ) : null}

            {canCreateOrReviseBudgets ? <BudgetComposerForm events={events} /> : null}
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
            description="Budget composition requires Event Management access. Budget review requires Organizational Approver privileges."
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
              : "An unexpected error disrupted the connection to the budget authorization core."
          }
          tone="error"
        />
      </div>
    );
  }
}
