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

    return (
      <>
        <PageHeader
          eyebrow="Budget requests"
          title="Create, submit, review, and revise full event budgets"
          description="Event managers build full itemized budget versions here. Approvers either approve the submitted version as the final budget or return it for revision."
          action={
            <div className="flex flex-wrap gap-2">
              <Badge variant="info">{budgets.length} visible version(s)</Badge>
              <Badge variant="success">
                {budgets.filter((budget) => budget.state === "APPROVED").length} approved
              </Badge>
              <Link
                href="/dashboard/budgets"
                className="focus-ring inline-flex h-8 items-center rounded-full border border-border bg-panel px-3 text-xs font-semibold text-foreground shadow-sm transition hover:border-primary/25 hover:bg-background hover:text-primary"
              >
                Final budgets
              </Link>
            </div>
          }
        />

        <FilterCard resetHref="/dashboard/budget-requests">
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
                { value: "SUBMITTED", label: "Submitted for review" },
                { value: "REVISED", label: "Returned for revision" },
                { value: "APPROVED", label: "Approved final" },
              ]}
            />
          </Field>
        </FilterCard>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_420px]">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Budget version queue</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {budgets.length === 0 ? (
                <StatePanel
                  icon={SearchSlash}
                  title="No budget versions match this view"
                  description="Event managers can create an itemized budget below and submit it for approver review."
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
                            href={`${buildRelativeHref("/dashboard/budget-requests", params, {
                              budgetId: budget.id,
                            })}#details-panel`}
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
                            Created by {budget.createdBy?.fullName ?? "Unknown"}
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

          <div id="details-panel" className="space-y-6">
            {selectedBudget ? (
              <div key={selectedBudget.id} className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl">Selected budget request</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-0">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={getBudgetStateTone(selectedBudget.state)}>
                        {formatEnumLabel(selectedBudget.state)}
                      </Badge>
                      <Badge variant="neutral">{selectedBudget.event.title}</Badge>
                      {selectedBudget.isActive ? <Badge variant="success">Final budget</Badge> : null}
                    </div>
                    <div className="rounded-[1rem] border border-border/70 bg-panel-muted px-4 py-4">
                      <div className="data-kicker">Version title</div>
                      <div className="mt-2 text-base font-semibold text-foreground">
                        {selectedBudget.title ?? `Version ${selectedBudget.version}`}
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        Created {formatDateTime(selectedBudget.createdAt)}
                      </div>
                    </div>
                    <div className="rounded-[1rem] border border-border/70 bg-panel px-4 py-4 text-sm leading-6 text-muted-foreground">
                      <div className="data-kicker">Total amount</div>
                      <div className="mt-2 text-foreground">
                        {selectedBudget.totalAmount
                          ? formatMoney(selectedBudget.totalAmount)
                          : "Pending"}
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
      </>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      return (
        <StatePanel
          icon={ShieldAlert}
          title="This account cannot access budget requests"
          description="Budget request creation belongs to event managers, while review belongs to organizational approvers."
          tone="warning"
        />
      );
    }

    return (
      <StatePanel
        icon={AlertTriangle}
        title="Budget requests could not be loaded"
        description={
          error instanceof ApiError
            ? error.message
            : "The live backend could not prepare the budget request workspace."
        }
        tone="error"
      />
    );
  }
}
