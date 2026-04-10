import Link from "next/link";
import { AlertTriangle, SearchSlash, ShieldAlert } from "lucide-react";

import {
  getIncomeRecord,
  listIncomeRecords,
  listInternalEventOptions,
} from "@/lib/api/internal";
import { buildRelativeHref } from "@/lib/detail-query";
import { ApiError } from "@/lib/api/shared";
import {
  formatDate,
  formatDateTime,
  formatEnumLabel,
  formatMoney,
  getIncomeStateTone,
} from "@/lib/format";
import { IncomeRecordForm } from "@/components/internal/payments-actions";
import { FilterCard } from "@/components/internal/filter-card";
import { SupportingDocumentList } from "@/components/internal/supporting-document-list";
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

export default async function IncomeRecordsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const eventId = typeof params.eventId === "string" ? params.eventId : undefined;
  const search = typeof params.search === "string" ? params.search : undefined;
  const incomeRecordId =
    typeof params.incomeRecordId === "string" ? params.incomeRecordId : undefined;

  try {
    const [incomeRecords, events] = await Promise.all([
      listIncomeRecords({ eventId, search }),
      listInternalEventOptions(),
    ]);

    const selectedIncomeRecordId =
      incomeRecords.find((record) => record.id === incomeRecordId)?.id ?? incomeRecords[0]?.id;
    const selectedIncome = selectedIncomeRecordId
      ? await getIncomeRecord(selectedIncomeRecordId)
      : null;

    return (
      <>
        <PageHeader
          eyebrow="Manual income"
          title="Track non-registration event income with protected evidence"
          description="Finance records sponsor, donation, university support, and other approved income here. Every record remains event-linked and review-safe."
          action={
            <div className="flex flex-wrap gap-2">
              <Badge variant="success">{incomeRecords.length} visible records</Badge>
              <Badge variant="info">Event-linked only</Badge>
            </div>
          }
        />

        <FilterCard resetHref="/dashboard/income-records">
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
          <Field label="Search">
            <Input
              name="search"
              defaultValue={search ?? ""}
              placeholder="Source label or event"
            />
          </Field>
        </FilterCard>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_420px]">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Income ledger entries</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {incomeRecords.length === 0 ? (
                <StatePanel
                  icon={SearchSlash}
                  title="No manual income records match this view"
                  description="When sponsor, donation, or university support records are entered, they will appear here with protected evidence linkage."
                  tone="empty"
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Source</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {incomeRecords.map((record) => (
                      <TableRow
                        key={record.id}
                        data-state={
                          record.id === selectedIncomeRecordId ? "selected" : undefined
                        }
                      >
                        <TableCell className="align-top">
                          <Link
                            href={buildRelativeHref("/dashboard/income-records", params, {
                              incomeRecordId: record.id,
                            })}
                            className={
                              record.id === selectedIncomeRecordId
                                ? "focus-ring rounded-sm font-semibold text-primary"
                                : "focus-ring rounded-sm font-semibold text-foreground hover:text-primary hover:underline"
                            }
                            aria-current={
                              record.id === selectedIncomeRecordId ? "page" : undefined
                            }
                          >
                            {record.sourceLabel}
                          </Link>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {formatEnumLabel(record.sourceType)}
                          </div>
                        </TableCell>
                        <TableCell>{record.event.title}</TableCell>
                        <TableCell>{formatMoney(record.amount)}</TableCell>
                        <TableCell>
                          <Badge variant={getIncomeStateTone(record.state)}>
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
            {selectedIncome ? (
              <div key={selectedIncome.id} className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl">Selected income record</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-0">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={getIncomeStateTone(selectedIncome.state)}>
                        {formatEnumLabel(selectedIncome.state)}
                      </Badge>
                      <Badge variant="neutral">{formatEnumLabel(selectedIncome.sourceType)}</Badge>
                    </div>
                    <div className="rounded-[1rem] border border-border/70 bg-panel-muted px-4 py-4">
                      <div className="data-kicker">Source label</div>
                      <div className="mt-2 text-base font-semibold text-foreground">
                        {selectedIncome.sourceLabel}
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {selectedIncome.event.title}
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-[1rem] border border-border/70 bg-panel px-4 py-4 text-sm leading-6 text-muted-foreground">
                        <div className="data-kicker">Amount</div>
                        <div className="mt-2 text-foreground">{formatMoney(selectedIncome.amount)}</div>
                      </div>
                      <div className="rounded-[1rem] border border-border/70 bg-panel px-4 py-4 text-sm leading-6 text-muted-foreground">
                        <div className="data-kicker">Collected</div>
                        <div className="mt-2 text-foreground">
                          {formatDate(selectedIncome.collectedAt)}
                        </div>
                      </div>
                    </div>
                    <div className="rounded-[1rem] border border-border/70 bg-panel px-4 py-4 text-sm leading-6 text-muted-foreground">
                      <div className="data-kicker">Protected reference</div>
                      <div className="mt-2">
                        {selectedIncome.referenceText ?? "No additional reference text provided."}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Recorded {formatDateTime(selectedIncome.createdAt)}
                      {selectedIncome.verifiedBy
                        ? ` / Verified by ${selectedIncome.verifiedBy.fullName}`
                        : ""}
                    </div>
                  </CardContent>
                </Card>
                <SupportingDocumentList
                  documents={selectedIncome.documents}
                  title="Protected evidence"
                  emptyMessage="This income record does not yet have an attached evidence file."
                />
              </div>
            ) : null}
            <IncomeRecordForm events={events} />
          </div>
        </div>
      </>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      return (
        <StatePanel
          icon={ShieldAlert}
          title="This account cannot access income record controls"
          description="The live backend only allows finance and system-admin roles to manage manual income records."
          tone="warning"
        />
      );
    }

    return (
      <StatePanel
        icon={AlertTriangle}
        title="Income records could not be loaded"
        description={
          error instanceof ApiError
            ? error.message
            : "The live backend could not return the internal income ledger right now."
        }
        tone="error"
      />
    );
  }
}
