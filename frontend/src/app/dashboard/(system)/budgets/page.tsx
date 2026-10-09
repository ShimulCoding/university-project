import Link from "next/link";
import { AlertTriangle, SearchSlash, ShieldAlert, Briefcase, FileText, CheckCircle2, FileBarChart, PieChart, ShieldCheck } from "lucide-react";

import { BudgetPdfDownloadButton } from "@/components/internal/budget-pdf-download-button";

import { getBudget, listBudgets, listInternalEventOptions } from "@/lib/api/internal";
import { buildRelativeHref } from "@/lib/detail-query";
import { ApiError } from "@/lib/api/shared";
import {
  formatDateTime,
  formatEnumLabel,
  formatMoney,
  getBudgetStateTone,
} from "@/lib/format";
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

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const eventId = typeof params.eventId === "string" ? params.eventId : undefined;
  const budgetId = typeof params.budgetId === "string" ? params.budgetId : undefined;

  try {
    const [budgets, events] = await Promise.all([
      listBudgets({ eventId, state: "APPROVED", isActive: "true" }),
      listInternalEventOptions(),
    ]);
    const selectedBudgetId = budgets.find((budget) => budget.id === budgetId)?.id ?? budgets[0]?.id;
    const selectedBudget = selectedBudgetId ? await getBudget(selectedBudgetId) : null;

    return (
      <div className="flex flex-col gap-8 pb-16">
        {/* HERO SECTION */}
        <section className="relative overflow-hidden rounded-3xl border border-border/40 bg-card/50 shadow-sm backdrop-blur-xl px-8 py-10 lg:px-12 lg:py-12">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
          <div className="absolute top-0 right-0 -z-10 m-auto h-[400px] w-[400px] rounded-full bg-primary/5 opacity-50 blur-[100px] pointer-events-none translate-x-1/4 -translate-y-1/4" />
          
          <div className="relative z-10 flex flex-col gap-5 max-w-3xl">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="neutral" className="px-3 py-1 font-semibold tracking-wide uppercase border-primary/20 bg-primary/5 text-primary backdrop-blur-md">
                <Briefcase className="w-3.5 h-3.5 mr-1.5 inline-block" />
                Financial Management
              </Badge>
              <Badge variant="neutral" className="px-3 py-1 font-medium tracking-wide border-muted-foreground/20 bg-muted/50 text-muted-foreground backdrop-blur-md">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 inline-block" />
                Finalized Allocations
              </Badge>
            </div>
            
            <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground">
              Master <span className="text-transparent bg-clip-text bg-gradient-to-br from-primary via-primary/90 to-primary/60">Budgets</span>
            </h1>
            
            <p className="text-muted-foreground text-base md:text-lg leading-relaxed font-medium">
              Review and manage approved financial allocations for university initiatives. This workspace displays exclusively finalized and active budgets. Drafts, pending approvals, and historical revisions remain secured within the Budget Requests queue.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Badge variant="neutral" className="bg-background/80 backdrop-blur-sm border-border/60 text-sm py-1.5 px-3 shadow-sm">
                <FileBarChart className="w-4 h-4 mr-2 inline-block text-primary/70" />
                {budgets.length} Finalized Budget(s)
              </Badge>
              <Link
                href="/dashboard/budget-requests"
                className="inline-flex h-9 items-center rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground shadow-sm transition hover:border-primary/30 hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <PieChart className="w-4 h-4 mr-2 text-muted-foreground" />
                Go to Budget Requests
              </Link>
            </div>
          </div>
        </section>

        {/* FILTERS */}
        <FilterCard resetHref="/dashboard/budgets">
          <Field label="University Initiative">
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
        </FilterCard>

        {/* WORKSPACE */}
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.2fr)_460px] items-start">
          
          {/* BUDGETS TABLE */}
          <Card className="border-border/40 shadow-sm bg-background/40 backdrop-blur-xl overflow-hidden flex flex-col h-full">
            <CardHeader className="border-b border-border/30 bg-muted/10 pb-5">
              <CardTitle className="text-xl tracking-tight">Approved Allocations</CardTitle>
              <CardDescription>Select a finalized budget to view its detailed breakdown.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {budgets.length === 0 ? (
                <div className="p-12">
                  <StatePanel
                    icon={SearchSlash}
                    title="No Matching Records"
                    description="There are currently no final budgets that match the applied filters. Approved allocations will populate here automatically."
                    tone="empty"
                  />
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="font-semibold text-muted-foreground tracking-wider uppercase text-xs h-12 px-6">Version ID</TableHead>
                      <TableHead className="font-semibold text-muted-foreground tracking-wider uppercase text-xs h-12">Initiative</TableHead>
                      <TableHead className="font-semibold text-muted-foreground tracking-wider uppercase text-xs h-12">Allocated Total</TableHead>
                      <TableHead className="font-semibold text-muted-foreground tracking-wider uppercase text-xs h-12 text-center">Status</TableHead>
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
                              href={`${buildRelativeHref("/dashboard/budgets", params, {
                                budgetId: budget.id,
                              })}#details-panel`}
                              className={`font-bold transition-colors ${isSelected ? "text-primary" : "text-foreground hover:text-primary"}`}
                              aria-current={isSelected ? "page" : undefined}
                            >
                              v{budget.version}
                              {budget.title ? ` - ${budget.title}` : ""}
                            </Link>
                            <div className="mt-1 flex items-center gap-1 text-[10px] uppercase tracking-widest font-mono text-muted-foreground">
                              <ShieldCheck className="w-3 h-3" /> Final Record
                            </div>
                          </TableCell>
                          <TableCell className="text-sm font-medium">{budget.event.title}</TableCell>
                          <TableCell className="text-sm font-semibold">
                            {budget.totalAmount ? formatMoney(budget.totalAmount) : "Pending"}
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
                <Card className="border-border/50 shadow-sm bg-background/50 backdrop-blur-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-6 opacity-[0.02] pointer-events-none">
                    <FileBarChart className="w-40 h-40" />
                  </div>
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Badge variant={getBudgetStateTone(selectedBudget.state)} className="text-xs uppercase tracking-widest px-2 py-1 shadow-sm">
                        {formatEnumLabel(selectedBudget.state)}
                      </Badge>
                      {selectedBudget.isActive ? <Badge variant="success" className="text-xs uppercase tracking-widest px-2 py-1 shadow-sm">Active</Badge> : null}
                      <div className="ml-auto relative z-10">
                        <BudgetPdfDownloadButton budget={selectedBudget} />
                      </div>
                    </div>
                    <CardTitle className="text-2xl tracking-tight">Allocation Ledger</CardTitle>
                    <CardDescription className="text-muted-foreground font-mono text-xs mt-1">
                      Reference ID: {selectedBudget.id}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    
                    <div className="rounded-xl border border-border/50 bg-background/80 p-5 shadow-sm">
                      <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-3">
                        <FileText className="h-3 w-3" /> Budget Profile
                      </div>
                      <div className="text-base font-bold text-foreground">
                        {selectedBudget.title ?? `Version ${selectedBudget.version}`}
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground font-medium">
                        {selectedBudget.event.title}
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-border/50 bg-background/80 p-4 shadow-sm">
                        <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-3">
                          <PieChart className="h-3 w-3" /> Allocated Funds
                        </div>
                        <div className="text-xl font-bold text-foreground">
                          {selectedBudget.totalAmount
                            ? formatMoney(selectedBudget.totalAmount)
                            : "Pending"}
                        </div>
                      </div>
                      <div className="rounded-xl border border-border/50 bg-background/80 p-4 shadow-sm">
                        <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-3">
                          <CheckCircle2 className="h-3 w-3" /> Authorized On
                        </div>
                        <div className="font-mono text-sm text-foreground mt-2">
                          {formatDateTime(selectedBudget.createdAt)}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 pt-2">
                      <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-3 px-1">
                        Line-Item Breakdown
                      </div>
                      {selectedBudget.items.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-xl border border-border/40 bg-muted/20 p-4 transition-colors hover:bg-muted/40"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-foreground">
                                {item.label}
                              </div>
                              <div className="mt-1 flex items-center gap-1.5">
                                <Badge variant="neutral" className="text-[10px] uppercase tracking-widest px-1.5 py-0 border-border/50 bg-background/50">
                                  {item.category}
                                </Badge>
                              </div>
                            </div>
                            <div className="text-sm font-bold text-foreground">
                              {formatMoney(item.amount)}
                            </div>
                          </div>
                          {item.notes ? (
                            <div className="mt-3 text-sm leading-relaxed text-muted-foreground font-light border-t border-border/40 pt-2">
                              {item.notes}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="border-border/40 bg-muted/10 backdrop-blur-xl shadow-sm relative overflow-hidden">
                  <CardHeader>
                    <div className="flex items-center gap-2 mb-2">
                      <ShieldCheck className="w-4 h-4 text-muted-foreground" />
                      <Badge variant="neutral" className="w-fit text-[10px] uppercase tracking-widest px-2 py-0.5">Read-Only View</Badge>
                    </div>
                    <CardTitle className="text-lg tracking-tight">Access Control</CardTitle>
                    <CardDescription className="text-sm leading-relaxed mt-2">
                      Modifications cannot be made to finalized budgets. Financial revisions or new budgetary drafts must be initiated through the Budget Requests module.
                    </CardDescription>
                  </CardHeader>
                </Card>
              </div>
            ) : (
              <Card className="border-border/40 bg-background/50 backdrop-blur-xl shadow-sm relative overflow-hidden h-full flex flex-col justify-center min-h-[400px]">
                <div className="absolute top-0 right-0 p-4 opacity-[0.02] pointer-events-none">
                  <Briefcase className="w-32 h-32" />
                </div>
                <StatePanel
                  icon={PieChart}
                  title="No Selection"
                  description="Select a finalized budget from the ledger to view its detailed line-item breakdown and download official documentation."
                  tone="empty"
                />
              </Card>
            )}
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
            description="Access to master budgets is restricted to authorized financial officers, review board members, and executive administrators."
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
              : "An unexpected error disrupted the connection to the financial ledger."
          }
          tone="error"
        />
      </div>
    );
  }
}