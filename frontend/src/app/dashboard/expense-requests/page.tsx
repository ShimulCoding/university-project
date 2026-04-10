import Link from "next/link";
import { AlertTriangle, SearchSlash, ShieldAlert } from "lucide-react";

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

    return (
      <>
        <PageHeader
          eyebrow="Expense requests"
          title="Keep requested spending separate from actual settled expense"
          description="Expense requests stay in the approval flow until real expense records are created and settled. The dashboard keeps both layers visible without mixing them."
          action={
            <div className="flex flex-wrap gap-2">
              <Badge variant="info">{expenseRequests.length} visible requests</Badge>
              <Badge variant="success">
                {expenseRequests.filter((request) => request.state === "APPROVED").length} approved
              </Badge>
            </div>
          }
        />

        <FilterCard resetHref="/dashboard/expense-requests">
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
                { value: "PENDING_REVIEW", label: "Pending review" },
                { value: "APPROVED", label: "Approved" },
                { value: "RETURNED", label: "Returned" },
                { value: "REJECTED", label: "Rejected" },
              ]}
            />
          </Field>
        </FilterCard>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_420px]">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Expense request queue</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {expenseRequests.length === 0 ? (
                <StatePanel
                  icon={SearchSlash}
                  title="No expense requests match this view"
                  description="Create a new expense request below to start the protected spending approval flow."
                  tone="empty"
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Purpose</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenseRequests.map((request) => (
                      <TableRow
                        key={request.id}
                        data-state={
                          request.id === selectedExpenseRequestId ? "selected" : undefined
                        }
                      >
                        <TableCell className="align-top">
                          <Link
                            href={buildRelativeHref("/dashboard/expense-requests", params, {
                              expenseRequestId: request.id,
                            })}
                            className={
                              request.id === selectedExpenseRequestId
                                ? "focus-ring rounded-sm font-semibold text-primary"
                                : "focus-ring rounded-sm font-semibold text-foreground hover:text-primary hover:underline"
                            }
                            aria-current={
                              request.id === selectedExpenseRequestId ? "page" : undefined
                            }
                          >
                            {request.purpose}
                          </Link>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {request.event.title}
                          </div>
                        </TableCell>
                        <TableCell>{request.category}</TableCell>
                        <TableCell>{formatMoney(request.amount)}</TableCell>
                        <TableCell>
                          <Badge variant={getRequestStateTone(request.state)}>
                            {formatEnumLabel(request.state)}
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
            {selectedRequest ? (
              <div key={selectedRequest.id} className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl">Selected request</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-0">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={getRequestStateTone(selectedRequest.state)}>
                        {formatEnumLabel(selectedRequest.state)}
                      </Badge>
                      <Badge variant="neutral">{selectedRequest.category}</Badge>
                    </div>
                    <div className="rounded-[1rem] border border-border/70 bg-panel-muted px-4 py-4">
                      <div className="data-kicker">Purpose</div>
                      <div className="mt-2 text-base font-semibold text-foreground">
                        {selectedRequest.purpose}
                      </div>
                      <div className="mt-2 text-sm leading-6 text-muted-foreground">
                        {selectedRequest.justification ?? "No additional justification provided."}
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-[1rem] border border-border/70 bg-panel px-4 py-4 text-sm leading-6 text-muted-foreground">
                        <div className="data-kicker">Amount</div>
                        <div className="mt-2 text-foreground">
                          {formatMoney(selectedRequest.amount)}
                        </div>
                      </div>
                      <div className="rounded-[1rem] border border-border/70 bg-panel px-4 py-4 text-sm leading-6 text-muted-foreground">
                        <div className="data-kicker">Created</div>
                        <div className="mt-2 text-foreground">
                          {formatDateTime(selectedRequest.createdAt)}
                        </div>
                      </div>
                    </div>
                    {selectedRequest.expenseRecords.length > 0 ? (
                      <div className="space-y-3">
                        {selectedRequest.expenseRecords.map((record) => (
                          <div
                            key={record.id}
                            className="rounded-[1rem] border border-border/70 bg-panel-muted px-4 py-4"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="font-semibold text-foreground">{record.category}</div>
                              <Badge variant={getExpenseRecordStateTone(record.state)}>
                                {formatEnumLabel(record.state)}
                              </Badge>
                            </div>
                            <div className="mt-2 text-sm text-muted-foreground">
                              {formatMoney(record.amount)} / {formatDateTime(record.createdAt)}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
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
                  <Card tone="muted">
                    <CardHeader>
                      <CardTitle className="text-xl">Read-only request visibility</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
                      This session can inspect expense request history and linked settlements, but
                      only request authoring roles can create or submit expense requests here.
                    </CardContent>
                  </Card>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {canSubmitRequests ? <ExpenseRequestForm events={events} /> : null}
      </>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      return (
        <StatePanel
          icon={ShieldAlert}
          title="This account cannot access expense requests"
          description="The live backend only grants expense-request visibility to permitted internal operational roles."
          tone="warning"
        />
      );
    }

    return (
      <StatePanel
        icon={AlertTriangle}
        title="Expense requests could not be loaded"
        description={
          error instanceof ApiError
            ? error.message
            : "The live backend could not prepare the expense request workspace."
        }
        tone="error"
      />
    );
  }
}
