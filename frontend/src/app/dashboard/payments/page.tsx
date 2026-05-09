import Link from "next/link";
import { AlertTriangle, FileCheck, SearchSlash, ShieldAlert, BadgeDollarSign, User, CalendarDays, ExternalLink, FileText } from "lucide-react";

import { listInternalEventOptions, listPaymentVerificationQueue } from "@/lib/api/internal";
import { buildRelativeHref } from "@/lib/detail-query";
import { ApiError } from "@/lib/api/shared";
import { formatDateTime, formatEnumLabel, formatMoney, getPaymentStateTone } from "@/lib/format";
import { PaymentDecisionForm } from "@/components/internal/payments-actions";
import { FilterCard } from "@/components/internal/filter-card";
import { SupportingDocumentList } from "@/components/internal/supporting-document-list";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
    const selectedProofId = selectedProof?.id;

    return (
      <div className="flex flex-col gap-8 pb-16">
        {/* HERO SECTION */}
        <section className="relative overflow-hidden rounded-3xl border border-border/20 bg-background/50 shadow-2xl shadow-black/5 backdrop-blur-3xl px-8 py-10 lg:px-12 lg:py-12">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
          <div className="absolute top-0 left-0 -z-10 m-auto h-[300px] w-[300px] rounded-full bg-warning/10 opacity-60 blur-[100px] pointer-events-none -translate-x-1/4 -translate-y-1/4" />
          
          <div className="relative z-10 flex flex-col gap-6 max-w-3xl">
            <div className="flex items-center gap-3">
              <Badge variant="warning" className="px-3 py-1 font-semibold tracking-wider uppercase border-warning/30 bg-warning/10 text-warning backdrop-blur-md">
                <FileCheck className="w-3 h-3 mr-1.5 inline-block" />
                Proof Verification
              </Badge>
              <Badge variant="info" className="px-3 py-1 font-semibold tracking-wider uppercase border-info/30 bg-info/10 text-info backdrop-blur-md">
                Finance Authorized
              </Badge>
            </div>
            
            <h1 className="text-3xl lg:text-5xl font-black tracking-tight text-foreground">
              Verify <span className="text-transparent bg-clip-text bg-gradient-to-br from-warning via-warning/80 to-warning/50">Payments</span>
            </h1>
            
            <p className="text-muted-foreground text-lg leading-relaxed font-light">
              Securely authenticate incoming financial proofs against official banking endpoints. Submissions must be explicitly verified or rejected before they are logged in the event ledger.
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Badge variant="neutral" className="bg-background/50 backdrop-blur-sm border-border/50 text-sm py-1.5">
                <BadgeDollarSign className="w-4 h-4 mr-2 inline-block text-warning" />
                {queue.length} Pending authentications
              </Badge>
            </div>
          </div>
        </section>

        {/* CONTROLS */}
        <FilterCard resetHref="/dashboard/payments">
          <Field label="Target Initiative">
            <Select
              name="eventId"
              defaultValue={eventId ?? ""}
              options={[
                { value: "", label: "All Active Initiatives" },
                ...events.map((event) => ({
                  value: event.id,
                  label: event.title,
                })),
              ]}
            />
          </Field>
          <Field label="Query Record">
            <Input
              name="search"
              defaultValue={search ?? ""}
              placeholder="Search by participant name, email, or transaction reference..."
            />
          </Field>
        </FilterCard>

        {/* WORKSPACE AREA */}
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.25fr)_450px] items-start">
          
          {/* QUEUE TABLE */}
          <Card className="border-border/40 shadow-xl shadow-black/5 bg-background/40 backdrop-blur-xl overflow-hidden flex flex-col h-full">
            <CardHeader className="border-b border-border/30 bg-muted/10 pb-5">
              <CardTitle className="text-xl tracking-tight">Active Queue</CardTitle>
              <CardDescription>Select a submission row to inspect its proof files and execute a decision.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {queue.length === 0 ? (
                <div className="p-12">
                  <StatePanel
                    icon={SearchSlash}
                    title="Queue Cleared"
                    description="There are currently no payment proofs waiting for finance verification matching your criteria."
                    tone="empty"
                  />
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="font-semibold text-muted-foreground tracking-wider uppercase text-xs h-12 px-6">Participant</TableHead>
                      <TableHead className="font-semibold text-muted-foreground tracking-wider uppercase text-xs h-12">Initiative</TableHead>
                      <TableHead className="font-semibold text-muted-foreground tracking-wider uppercase text-xs h-12">Channel</TableHead>
                      <TableHead className="font-semibold text-muted-foreground tracking-wider uppercase text-xs h-12 text-right">Amount</TableHead>
                      <TableHead className="font-semibold text-muted-foreground tracking-wider uppercase text-xs h-12 text-center">Posture</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {queue.map((item) => {
                      const isSelected = item.id === selectedProofId;
                      return (
                        <TableRow
                          key={item.id}
                          className={`transition-colors ${isSelected ? "bg-primary/5 hover:bg-primary/10 border-l-2 border-l-primary" : "hover:bg-muted/30 border-l-2 border-l-transparent"}`}
                        >
                          <TableCell className="align-top px-6 py-4">
                            <Link
                              href={`${buildRelativeHref("/dashboard/payments", params, { proofId: item.id })}#details-panel`}
                              className={`font-bold transition-colors ${isSelected ? "text-primary" : "text-foreground hover:text-primary"}`}
                            >
                              {item.registration.participantName}
                            </Link>
                            <div className="mt-1 font-mono text-[11px] text-muted-foreground tracking-widest bg-muted/50 w-fit px-1.5 py-0.5 rounded">
                              {item.registration.registrationCode}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm font-medium">{item.event.title}</TableCell>
                          <TableCell className="text-sm text-muted-foreground font-medium">{item.externalChannel}</TableCell>
                          <TableCell className="text-right font-mono font-bold">
                            {item.amount ? formatMoney(item.amount) : <span className="text-muted-foreground text-xs uppercase tracking-wider font-sans">Pending</span>}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={getPaymentStateTone(item.state)} className="text-[10px] uppercase tracking-widest px-2 py-0.5">
                              {formatEnumLabel(item.state)}
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

          {/* INSPECTION PANEL */}
          <div id="details-panel" className="space-y-6">
            {!selectedProof ? null : (
              <div key={selectedProof.id} className="space-y-6">
                
                {/* PROOF METADATA CARD */}
                <Card className="border-primary/20 shadow-xl shadow-primary/5 bg-background/50 backdrop-blur-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none">
                    <FileCheck className="w-40 h-40" />
                  </div>
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant={getPaymentStateTone(selectedProof.state)} className="text-xs uppercase tracking-widest px-2 py-1 shadow-sm">
                        {formatEnumLabel(selectedProof.state)}
                      </Badge>
                    </div>
                    <CardTitle className="text-2xl tracking-tight">Inspection Deck</CardTitle>
                    <CardDescription className="text-primary/80 font-medium">
                      {selectedProof.event.title}
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent className="space-y-5">
                    
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-border/50 bg-background/80 p-4 shadow-sm">
                        <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-2">
                          <User className="h-3 w-3" /> Participant Origin
                        </div>
                        <div className="font-bold text-foreground truncate">
                          {selectedProof.registration.participantName}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground truncate">
                          {selectedProof.registration.email}
                        </div>
                      </div>
                      
                      <div className="rounded-xl border border-border/50 bg-background/80 p-4 shadow-sm">
                        <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-2">
                          <CalendarDays className="h-3 w-3" /> Logged Timestamp
                        </div>
                        <div className="font-mono text-sm text-foreground mt-3">
                          {formatDateTime(selectedProof.submittedAt)}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-border/50 bg-background/80 p-4 shadow-sm">
                      <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-2">
                        <FileText className="h-3 w-3" /> Declaration Note
                      </div>
                      <div className="text-sm font-light leading-relaxed text-foreground mt-2">
                        {selectedProof.referenceText ?? <span className="italic text-muted-foreground">No supplementary note provided.</span>}
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-border/50 bg-background/80 p-4 shadow-sm">
                        <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-2">Payment Gateway</div>
                        <div className="font-bold text-foreground">{selectedProof.externalChannel}</div>
                      </div>
                      <div className="rounded-xl border border-border/50 bg-background/80 p-4 shadow-sm">
                        <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-2">Transaction Ref</div>
                        <div className="font-mono text-sm font-bold text-primary truncate">
                          {selectedProof.transactionReference ?? <span className="text-muted-foreground font-sans text-xs italic">Unspecified</span>}
                        </div>
                      </div>
                    </div>

                  </CardContent>
                </Card>

                {/* ATTACHMENTS */}
                <SupportingDocumentList
                  documents={selectedProof.documents}
                  title="Cryptographic Evidences"
                  emptyMessage="No proof file is attached to this submission."
                />
                
                {/* DECISION MATRIX */}
                <PaymentDecisionForm paymentProofId={selectedProof.id} />
              </div>
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
            description="Cryptographic payment verification is restricted to authenticated Finance Controllers and System Administrators."
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
              : "An unexpected error disrupted the connection to the payment verification core."
          }
          tone="error"
        />
      </div>
    );
  }
}
