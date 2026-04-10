import Link from "next/link";
import { AlertTriangle, SearchSlash, ShieldAlert } from "lucide-react";

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
      <>
        <PageHeader
          eyebrow="Approvals"
          title="Keep approval decisions explicit, auditable, and separated from request authorship"
          description="The approval queue keeps request amount, supporting-document coverage, and request context visible while preserving the no-self-approval rule in the backend."
          action={
            <div className="flex flex-wrap gap-2">
              <Badge variant="warning">{queue.length} queued decisions</Badge>
              <Badge variant="info">Approver only</Badge>
            </div>
          }
        />

        <FilterCard resetHref="/dashboard/approvals">
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
          <Field label="Entity type">
            <Select
              name="entityType"
              defaultValue={entityType ?? ""}
              options={[
                { value: "", label: "All request types" },
                { value: "BUDGET_REQUEST", label: "Budget request" },
                { value: "EXPENSE_REQUEST", label: "Expense request" },
              ]}
            />
          </Field>
        </FilterCard>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_420px]">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Decision queue</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {queue.length === 0 ? (
                <StatePanel
                  icon={SearchSlash}
                  title="No requests are waiting for approval"
                  description="Submitted requests appear here when they cross into approver review."
                  tone="empty"
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {queue.map((item) => (
                      <TableRow
                        key={`${item.entityType}-${item.entityId}`}
                        data-state={
                          item.entityId === selectedItem?.entityId &&
                          item.entityType === selectedItem.entityType
                            ? "selected"
                            : undefined
                        }
                      >
                        <TableCell className="align-top">
                          <Link
                            href={buildRelativeHref("/dashboard/approvals", params, {
                              entityType: item.entityType,
                              entityId: item.entityId,
                            })}
                            className={
                              item.entityId === selectedItem?.entityId &&
                              item.entityType === selectedItem.entityType
                                ? "focus-ring rounded-sm font-semibold text-primary"
                                : "focus-ring rounded-sm font-semibold text-foreground hover:text-primary hover:underline"
                            }
                            aria-current={
                              item.entityId === selectedItem?.entityId &&
                              item.entityType === selectedItem.entityType
                                ? "page"
                                : undefined
                            }
                          >
                            {formatEnumLabel(item.entityType)}
                          </Link>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {item.requestedBy?.fullName ?? "Unknown requester"}
                          </div>
                        </TableCell>
                        <TableCell>{item.event.title}</TableCell>
                        <TableCell>{formatMoney(item.amount)}</TableCell>
                        <TableCell>
                          <Badge variant={getRequestStateTone(item.state)}>
                            {formatEnumLabel(item.state)}
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
            {selectedItem && selectedRecord ? (
              <div
                key={`${selectedItem.entityType}-${selectedItem.entityId}`}
                className="space-y-6"
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl">Selected approval target</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-0">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={getRequestStateTone(selectedItem.state)}>
                        {formatEnumLabel(selectedItem.state)}
                      </Badge>
                      <Badge variant="neutral">{formatEnumLabel(selectedItem.entityType)}</Badge>
                    </div>
                    <div className="rounded-[1rem] border border-border/70 bg-panel-muted px-4 py-4">
                      <div className="data-kicker">Request summary</div>
                      <div className="mt-2 text-base font-semibold text-foreground">
                        {selectedItem.summary.purpose}
                      </div>
                      <div className="mt-2 text-sm leading-6 text-muted-foreground">
                        {selectedItem.summary.justification ?? "No additional justification provided."}
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-[1rem] border border-border/70 bg-panel px-4 py-4 text-sm leading-6 text-muted-foreground">
                        <div className="data-kicker">Amount</div>
                        <div className="mt-2 text-foreground">{formatMoney(selectedItem.amount)}</div>
                      </div>
                      <div className="rounded-[1rem] border border-border/70 bg-panel px-4 py-4 text-sm leading-6 text-muted-foreground">
                        <div className="data-kicker">Created</div>
                        <div className="mt-2 text-foreground">
                          {formatDateTime(selectedItem.createdAt)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <SupportingDocumentList documents={selectedRecord.documents} />
                <DecisionHistoryCard decisions={selectedRecord.approvalDecisions} />
                <ApprovalDecisionForm item={selectedItem} />
              </div>
            ) : null}
          </div>
        </div>
      </>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      return (
        <StatePanel
          icon={ShieldAlert}
          title="This account cannot access the approval queue"
          description="The live backend only allows system-admin and organizational-approver roles to use this workflow."
          tone="warning"
        />
      );
    }

    return (
      <StatePanel
        icon={AlertTriangle}
        title="The approval queue could not be loaded"
        description={
          error instanceof ApiError
            ? error.message
            : "The live backend could not prepare the approval workspace."
        }
        tone="error"
      />
    );
  }
}
