import Link from "next/link";
import { AlertTriangle, SearchSlash, ShieldAlert } from "lucide-react";

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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
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
  const state = typeof params.state === "string" ? params.state : undefined;
  const isActive = typeof params.isActive === "string" ? params.isActive : undefined;
  const budgetId = typeof params.budgetId === "string" ? params.budgetId : undefined;

  try {
    const user = await getCurrentUser();
    const canCreateOrReviseBudgets = hasAnyRole(user, ["SYSTEM_ADMIN", "FINANCIAL_CONTROLLER"]);
    const canApproveBudgets = hasAnyRole(user, ["SYSTEM_ADMIN", "ORGANIZATIONAL_APPROVER"]);
    const canUseBudgetControls = canCreateOrReviseBudgets || canApproveBudgets;
    const [budgets, events] = await Promise.all([
      listBudgets({ eventId, state, isActive }),
      listInternalEventOptions(),
    ]);
    const selectedBudgetId = budgets.find((budget) => budget.id === budgetId)?.id ?? budgets[0]?.id;
    const selectedBudget = selectedBudgetId ? await getBudget(selectedBudgetId) : null;

    return (
      <>
        <PageHeader
          eyebrow="Budget management"
          title="Preserve budget versions, item structure, and activation history"
          description="Budgets are kept as explicit versions so revision history stays visible. Finance can activate the right version without silently overwriting older records."
          action={
            <div className="flex flex-wrap gap-2">
              <Badge variant="success">
                {budgets.filter((budget) => budget.isActive).length} active version(s)
              </Badge>
              <Badge variant="info">{budgets.length} visible versions</Badge>
            </div>
          }
        />

        <FilterCard resetHref="/dashboard/budgets">
          <Field label="Event">
            <Select
              name="eventId"
              defaultValue={eventId ?? ""}
              options={[
                { value: "", label: "All events" },
                ...events.map((event) => ({
                  value: event.id,
                  label: event.title,
                })),
              ]}
            />
          </Field>
          <Field label="State">
            <Select
              name="state"
              defaultValue={state ?? ""}
              options={[
                { value: "", label: "All states" },
                { value: "DRAFT", label: "Draft" },
                { value: "SUBMITTED", label: "Submitted" },
                { value: "APPROVED", label: "Approved" },
                { value: "REVISED", label: "Revised" },
              ]}
            />
          </Field>
          <Field label="Active status">
            <Select
              name="isActive"
              defaultValue={isActive ?? ""}
              options={[
                { value: "", label: "All versions" },
                { value: "true", label: "Active only" },
                { value: "false", label: "Inactive only" },
              ]}
            />
          </Field>
        </FilterCard>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_420px]">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Budget versions</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {budgets.length === 0 ? (
                <StatePanel
                  icon={SearchSlash}
                  title="No budgets match this filter set"
                  description="Budget versions appear here once finance creates them for an event."
                  tone="empty"
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Version</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {budgets.map((budget) => (
                      <TableRow
                        key={budget.id}
                        data-state={budget.id === selectedBudgetId ? "selected" : undefined}
                      >
                        <TableCell className="align-top">
                          <Link
                            href={buildRelativeHref("/dashboard/budgets", params, {
                              budgetId: budget.id,
                            })}
                            className={
                              budget.id === selectedBudgetId
                                ? "focus-ring rounded-sm font-semibold text-primary"
                                : "focus-ring rounded-sm font-semibold text-foreground hover:text-primary hover:underline"
                            }
                            aria-current={budget.id === selectedBudgetId ? "page" : undefined}
                          >
                            v{budget.version}
                            {budget.title ? ` - ${budget.title}` : ""}
                          </Link>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {budget.isActive ? "Active version" : "Historical version"}
                          </div>
                        </TableCell>
                        <TableCell>{budget.event.title}</TableCell>
                        <TableCell>
                          {budget.totalAmount ? formatMoney(budget.totalAmount) : "Pending total"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getBudgetStateTone(budget.state)}>
                            {formatEnumLabel(budget.state)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            {selectedBudget ? (
              <div key={selectedBudget.id} className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl">Selected budget version</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-0">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={getBudgetStateTone(selectedBudget.state)}>
                        {formatEnumLabel(selectedBudget.state)}
                      </Badge>
                      {selectedBudget.isActive ? <Badge variant="success">Active</Badge> : null}
                    </div>
                    <div className="rounded-[1rem] border border-border/70 bg-panel-muted px-4 py-4">
                      <div className="data-kicker">Version title</div>
                      <div className="mt-2 text-base font-semibold text-foreground">
                        {selectedBudget.title ?? `Version ${selectedBudget.version}`}
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {selectedBudget.event.title}
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-[1rem] border border-border/70 bg-panel px-4 py-4 text-sm leading-6 text-muted-foreground">
                        <div className="data-kicker">Total amount</div>
                        <div className="mt-2 text-foreground">
                          {selectedBudget.totalAmount
                            ? formatMoney(selectedBudget.totalAmount)
                            : "Pending"}
                        </div>
                      </div>
                      <div className="rounded-[1rem] border border-border/70 bg-panel px-4 py-4 text-sm leading-6 text-muted-foreground">
                        <div className="data-kicker">Created</div>
                        <div className="mt-2 text-foreground">
                          {formatDateTime(selectedBudget.createdAt)}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {selectedBudget.items.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-[1rem] border border-border/70 bg-panel-muted px-4 py-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-foreground">
                                {item.label}
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {item.category}
                              </div>
                            </div>
                            <div className="text-sm font-semibold text-foreground">
                              {formatMoney(item.amount)}
                            </div>
                          </div>
                          {item.notes ? (
                            <div className="mt-3 text-sm leading-6 text-muted-foreground">
                              {item.notes}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                {canUseBudgetControls ? (
                  <>
                    <BudgetStateForm
                      budget={selectedBudget}
                      canSubmit={canCreateOrReviseBudgets}
                      canApprove={canApproveBudgets}
                      canActivate={canCreateOrReviseBudgets}
                    />
                    {canCreateOrReviseBudgets ? (
                      <BudgetComposerForm events={events} budget={selectedBudget} />
                    ) : null}
                  </>
                ) : (
                  <Card tone="muted">
                    <CardHeader>
                      <CardTitle className="text-xl">Read-only role on budget history</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
                      This session can inspect budget versions and item structure, but budget
                      submission, approval, and activation remain separated by role.
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {canCreateOrReviseBudgets ? <BudgetComposerForm events={events} /> : null}
      </>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      return (
        <StatePanel
          icon={ShieldAlert}
          title="This account cannot access budget management"
          description="The live backend only grants budget visibility to system admin, finance, approver, and event-management roles."
          tone="warning"
        />
      );
    }

    return (
      <StatePanel
        icon={AlertTriangle}
        title="Budget management could not be loaded"
        description={
          error instanceof ApiError
            ? error.message
            : "The live backend could not prepare the budget management workspace."
        }
        tone="error"
      />
    );
  }
}
