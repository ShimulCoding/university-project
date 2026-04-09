import Link from "next/link";
import { AlertTriangle, CreditCard, SearchSlash, ShieldAlert } from "lucide-react";

import { listInternalEventOptions, listPaymentVerificationQueue } from "@/lib/api/internal";
import { ApiError } from "@/lib/api/shared";
import { formatDateTime, formatEnumLabel, formatMoney, getPaymentStateTone } from "@/lib/format";
import { PaymentDecisionForm } from "@/components/internal/payments-actions";
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

export default async function PaymentVerificationQueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const eventId = typeof params.eventId === "string" ? params.eventId : undefined;
  const search = typeof params.search === "string" ? params.search : undefined;
  const proofId = typeof params.proofId === "string" ? params.proofId : undefined;

  try {
    const [queue, events] = await Promise.all([
      listPaymentVerificationQueue({ eventId, search }),
      listInternalEventOptions(),
    ]);
    const selectedProof = queue.find((item) => item.id === proofId) ?? queue[0] ?? null;

    return (
      <>
        <PageHeader
          eyebrow="Finance verification"
          title="Review external payment proof without exposing it publicly"
          description="This queue stays inside the protected workspace. It keeps participant context, proof coverage, and controlled payment-state transitions visible to finance reviewers only."
          action={
            <div className="flex flex-wrap gap-2">
              <Badge variant="warning">{queue.length} pending proofs</Badge>
              <Badge variant="info">Finance only</Badge>
            </div>
          }
        />

        <FilterCard resetHref="/dashboard/payments">
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
              placeholder="Student, email, or reference"
            />
          </Field>
        </FilterCard>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_420px]">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Pending verification queue</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {queue.length === 0 ? (
                <StatePanel
                  icon={SearchSlash}
                  title="No payment proofs are waiting for review"
                  description="When student-submitted proof enters pending verification, it will appear here with protected participant and document context."
                  tone="empty"
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Participant</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {queue.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="align-top">
                          <Link
                            href={`/dashboard/payments?proofId=${item.id}`}
                            className="font-semibold text-foreground hover:text-primary"
                          >
                            {item.registration.participantName}
                          </Link>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {item.registration.registrationCode}
                          </div>
                        </TableCell>
                        <TableCell>{item.event.title}</TableCell>
                        <TableCell>{item.externalChannel}</TableCell>
                        <TableCell>{item.amount ? formatMoney(item.amount) : "Pending amount"}</TableCell>
                        <TableCell>
                          <Badge variant={getPaymentStateTone(item.state)}>
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
            {!selectedProof ? null : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl">Selected proof</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-0">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={getPaymentStateTone(selectedProof.state)}>
                        {formatEnumLabel(selectedProof.state)}
                      </Badge>
                      <Badge variant="neutral">{selectedProof.event.title}</Badge>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-[1rem] border border-border/70 bg-panel-muted px-4 py-4 text-sm">
                        <div className="data-kicker">Participant</div>
                        <div className="mt-2 font-semibold text-foreground">
                          {selectedProof.registration.participantName}
                        </div>
                        <div className="mt-1 text-muted-foreground">
                          {selectedProof.registration.email}
                        </div>
                      </div>
                      <div className="rounded-[1rem] border border-border/70 bg-panel-muted px-4 py-4 text-sm">
                        <div className="data-kicker">Submitted</div>
                        <div className="mt-2 text-muted-foreground">
                          {formatDateTime(selectedProof.submittedAt)}
                        </div>
                      </div>
                    </div>
                    <div className="rounded-[1rem] border border-border/70 bg-panel-muted px-4 py-4 text-sm leading-6 text-muted-foreground">
                      <div className="data-kicker">Protected proof note</div>
                      <div className="mt-2">{selectedProof.referenceText ?? "No note provided."}</div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-[1rem] border border-border/70 bg-panel px-4 py-4 text-sm leading-6 text-muted-foreground">
                        <div className="data-kicker">Channel</div>
                        <div className="mt-2 text-foreground">{selectedProof.externalChannel}</div>
                      </div>
                      <div className="rounded-[1rem] border border-border/70 bg-panel px-4 py-4 text-sm leading-6 text-muted-foreground">
                        <div className="data-kicker">Reference</div>
                        <div className="mt-2 text-foreground">
                          {selectedProof.transactionReference ?? "No transaction reference"}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <SupportingDocumentList
                  documents={selectedProof.documents}
                  title="Protected proof files"
                  emptyMessage="No proof file is attached to this submission."
                />
                <PaymentDecisionForm paymentProofId={selectedProof.id} />
              </>
            )}

            <Card tone="muted">
              <CardHeader>
                <CardTitle className="text-xl">Operational boundary</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm leading-6 text-muted-foreground">
                Public pages only show event and summary-safe outputs. The evidence, reviewer
                notes, and participant-private context stay inside this finance workflow.
              </CardContent>
            </Card>
          </div>
        </div>
      </>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      return (
        <StatePanel
          icon={ShieldAlert}
          title="This account cannot access the payment verification queue"
          description="The live backend only allows finance and system-admin roles to review payment proof submissions."
          tone="warning"
        />
      );
    }

    return (
      <StatePanel
        icon={AlertTriangle}
        title="Payment verification could not be loaded"
        description={
          error instanceof ApiError
            ? error.message
            : "The live backend could not prepare the payment verification queue."
        }
        tone="error"
      />
    );
  }
}
