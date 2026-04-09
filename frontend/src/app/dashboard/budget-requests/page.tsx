import Link from "next/link";
import { AlertTriangle, SearchSlash, ShieldAlert } from "lucide-react";

import { getCurrentUser } from "@/lib/api/student";
import { hasAnyRole } from "@/lib/access";
import {
  getBudgetRequest,
  listBudgetRequests,
  listInternalEventOptions,
} from "@/lib/api/internal";
import { ApiError } from "@/lib/api/shared";
import {
  formatDateTime,
  formatEnumLabel,
  formatMoney,
  getRequestStateTone,
} from "@/lib/format";
import { BudgetRequestForm, SubmitRequestButton } from "@/components/internal/requests-actions";
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

export default async function BudgetRequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const eventId = typeof params.eventId === "string" ? params.eventId : undefined;
  const state = typeof params.state === "string" ? params.state : undefined;
  const budgetRequestId =
    typeof params.budgetRequestId === "string" ? params.budgetRequestId : undefined;

  try {
    const user = await getCurrentUser();
    const canSubmitRequests = hasAnyRole(user, ["SYSTEM_ADMIN", "EVENT_MANAGEMENT_USER"]);
    const [budgetRequests, events] = await Promise.all([
      listBudgetRequests({ eventId, state }),
      listInternalEventOptions(),
    ]);
    const selectedRequest =
      budgetRequestId ? await getBudgetRequest(budgetRequestId) : budgetRequests[0] ?? null;

    return (
      <>
        <PageHeader
          eyebrow="Budget requests"
          title="Prepare funding requests with protected document and decision history"
          description="Budget requests stay separate from budgets themselves. They move through review with explicit approval records and no silent status changes."
          action={
            <div className="flex flex-wrap gap-2">
              <Badge variant="info">{budgetRequests.length} visible requests</Badge>
              <Badge variant="success">
                {budgetRequests.filter((request) => request.state === "APPROVED").length} approved
              </Badge>
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
              <CardTitle className="text-xl">Budget request queue</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {budgetRequests.length === 0 ? (
                <StatePanel
                  icon={SearchSlash}
                  title="No budget requests match this view"
                  description="Create a new budget request below to start the protected review flow."
                  tone="empty"
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Purpose</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {budgetRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell className="align-top">
                          <Link
                            href={`/dashboard/budget-requests?budgetRequestId=${request.id}`}
                            className="font-semibold text-foreground hover:text-primary"
                          >
                            {request.purpose}
                          </Link>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Requested by {request.requestedBy?.fullName ?? "Unknown"}
                          </div>
                        </TableCell>
                        <TableCell>{request.event.title}</TableCell>
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
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl">Selected request</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-0">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={getRequestStateTone(selectedRequest.state)}>
                        {formatEnumLabel(selectedRequest.state)}
                      </Badge>
                      <Badge variant="neutral">{selectedRequest.event.title}</Badge>
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
                  </CardContent>
                </Card>
                <SupportingDocumentList documents={selectedRequest.documents} />
                <DecisionHistoryCard decisions={selectedRequest.approvalDecisions} />
                {canSubmitRequests &&
                (selectedRequest.state === "DRAFT" || selectedRequest.state === "RETURNED") ? (
                  <SubmitRequestButton
                    endpoint={`/requests/budget-requests/${selectedRequest.id}/submit`}
                    label="Budget request"
                  />
                ) : !canSubmitRequests ? (
                  <Card tone="muted">
                    <CardHeader>
                      <CardTitle className="text-xl">Read-only request visibility</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
                      This session can inspect request history and decisions, but only the request
                      authoring roles can create or submit budget requests from this page.
                    </CardContent>
                  </Card>
                ) : null}
              </>
            ) : null}
          </div>
        </div>

        {canSubmitRequests ? <BudgetRequestForm events={events} /> : null}
      </>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      return (
        <StatePanel
          icon={ShieldAlert}
          title="This account cannot access budget requests"
          description="The live backend only grants budget-request visibility to permitted internal operational roles."
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
