import Link from "next/link";
import { AlertTriangle, SearchSlash, ShieldAlert } from "lucide-react";

import {
  getExpenseRecord,
  listExpenseRecords,
  listExpenseRequests,
  listInternalEventOptions,
} from "@/lib/api/internal";
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
    const [expenseRecords, events, expenseRequests] = await Promise.all([
      listExpenseRecords({ eventId, state }),
      listInternalEventOptions(),
      listExpenseRequests({ state: "APPROVED" }),
    ]);
    const selectedRecord =
      expenseRecordId ? await getExpenseRecord(expenseRecordId) : expenseRecords[0] ?? null;

    return (
      <>
        <PageHeader
          eyebrow="Expense records"
          title="Track actual settled expense separately from request intent"
          description="Expense records represent real spending. Settlement, voiding, and supporting-document linkage stay visible because these records feed reconciliation."
          action={
            <div className="flex flex-wrap gap-2">
              <Badge variant="info">{expenseRecords.length} visible records</Badge>
              <Badge variant="success">
                {expenseRecords.filter((record) => record.state === "SETTLED").length} settled
              </Badge>
            </div>
          }
        />

        <FilterCard resetHref="/dashboard/expense-records">
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
                { value: "RECORDED", label: "Recorded" },
                { value: "SETTLED", label: "Settled" },
                { value: "VOIDED", label: "Voided" },
              ]}
            />
          </Field>
        </FilterCard>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_420px]">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Expense ledger</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {expenseRecords.length === 0 ? (
                <StatePanel
                  icon={SearchSlash}
                  title="No expense records match this view"
                  description="When actual spending is recorded, it will appear here alongside its settlement status."
                  tone="empty"
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenseRecords.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="align-top">
                          <Link
                            href={`/dashboard/expense-records?expenseRecordId=${record.id}`}
                            className="font-semibold text-foreground hover:text-primary"
                          >
                            {record.description}
                          </Link>
                          <div className="mt-1 text-xs text-muted-foreground">{record.category}</div>
                        </TableCell>
                        <TableCell>{record.event.title}</TableCell>
                        <TableCell>{formatMoney(record.amount)}</TableCell>
                        <TableCell>
                          <Badge variant={getExpenseRecordStateTone(record.state)}>
                            {formatEnumLabel(record.state)}
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
            {selectedRecord ? (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl">Selected expense record</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-0">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={getExpenseRecordStateTone(selectedRecord.state)}>
                        {formatEnumLabel(selectedRecord.state)}
                      </Badge>
                      <Badge variant="neutral">{selectedRecord.category}</Badge>
                    </div>
                    <div className="rounded-[1rem] border border-border/70 bg-panel-muted px-4 py-4">
                      <div className="data-kicker">Description</div>
                      <div className="mt-2 text-base font-semibold text-foreground">
                        {selectedRecord.description}
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {selectedRecord.event.title}
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-[1rem] border border-border/70 bg-panel px-4 py-4 text-sm leading-6 text-muted-foreground">
                        <div className="data-kicker">Amount</div>
                        <div className="mt-2 text-foreground">
                          {formatMoney(selectedRecord.amount)}
                        </div>
                      </div>
                      <div className="rounded-[1rem] border border-border/70 bg-panel px-4 py-4 text-sm leading-6 text-muted-foreground">
                        <div className="data-kicker">Paid date</div>
                        <div className="mt-2 text-foreground">
                          {formatDate(selectedRecord.paidAt)}
                        </div>
                      </div>
                    </div>
                    {selectedRecord.expenseRequest ? (
                      <div className="rounded-[1rem] border border-border/70 bg-panel-muted px-4 py-4 text-sm leading-6 text-muted-foreground">
                        <div className="data-kicker">Linked request</div>
                        <div className="mt-2 font-semibold text-foreground">
                          {selectedRecord.expenseRequest.purpose}
                        </div>
                        <div className="mt-1">
                          {formatMoney(selectedRecord.expenseRequest.amount)} /{" "}
                          {formatEnumLabel(selectedRecord.expenseRequest.state)}
                        </div>
                      </div>
                    ) : null}
                    <div className="text-sm text-muted-foreground">
                      Recorded by {selectedRecord.recordedBy?.fullName ?? "Unknown"} on{" "}
                      {formatDateTime(selectedRecord.createdAt)}
                    </div>
                  </CardContent>
                </Card>
                <SupportingDocumentList documents={selectedRecord.documents} />
                <ExpenseRecordStatePanel
                  expenseRecordId={selectedRecord.id}
                  allowSettle={selectedRecord.state === "RECORDED"}
                  allowVoid={selectedRecord.state !== "VOIDED"}
                />
              </>
            ) : null}
          </div>
        </div>

        <ExpenseRecordForm events={events} expenseRequests={expenseRequests} />
      </>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      return (
        <StatePanel
          icon={ShieldAlert}
          title="This account cannot access expense records"
          description="The live backend only grants expense-record visibility to permitted internal operational roles."
          tone="warning"
        />
      );
    }

    return (
      <StatePanel
        icon={AlertTriangle}
        title="Expense records could not be loaded"
        description={
          error instanceof ApiError
            ? error.message
            : "The live backend could not prepare the expense record workspace."
        }
        tone="error"
      />
    );
  }
}
