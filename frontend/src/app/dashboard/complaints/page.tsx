import Link from "next/link";
import { AlertTriangle, SearchSlash, ShieldAlert, FileWarning, Gavel, FileText, UserMinus, ShieldCheck } from "lucide-react";

import {
  getComplaint,
  listComplaintReviewQueue,
  listInternalEventOptions,
} from "@/lib/api/internal";
import { buildRelativeHref } from "@/lib/detail-query";
import { ApiError } from "@/lib/api/shared";
import { formatDateTime, formatEnumLabel, getComplaintStateTone } from "@/lib/format";
import { ComplaintWorkflowPanel } from "@/components/internal/complaints-actions";
import { ComplaintRoutingCard } from "@/components/internal/complaint-routing-card";
import { FilterCard } from "@/components/internal/filter-card";
import { SupportingDocumentList } from "@/components/internal/supporting-document-list";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

export default async function ComplaintsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const eventId = typeof params.eventId === "string" ? params.eventId : undefined;
  const state = typeof params.state === "string" ? params.state : undefined;
  const search = typeof params.search === "string" ? params.search : undefined;
  const complaintId = typeof params.complaintId === "string" ? params.complaintId : undefined;

  try {
    const [complaints, events] = await Promise.all([
      listComplaintReviewQueue({ eventId, state, search }),
      listInternalEventOptions(),
    ]);
    const selectedComplaintId =
      complaints.find((item) => item.id === complaintId)?.id ?? complaints[0]?.id;
    const selectedComplaint = selectedComplaintId ? await getComplaint(selectedComplaintId) : null;

    const activeCount = complaints.filter(c => c.state !== "CLOSED" && c.state !== "RESOLVED").length;

    return (
      <div className="flex flex-col gap-8 pb-16">
        {/* HERO SECTION */}
        <section className="relative overflow-hidden rounded-3xl border border-border/40 bg-card/50 shadow-sm backdrop-blur-xl px-8 py-10 lg:px-12 lg:py-12">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
          <div className="absolute top-0 right-0 -z-10 m-auto h-[400px] w-[400px] rounded-full bg-primary/5 opacity-50 blur-[100px] pointer-events-none translate-x-1/4 -translate-y-1/4" />
          
          <div className="relative z-10 flex flex-col gap-5 max-w-3xl">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="neutral" className="px-3 py-1 font-semibold tracking-wide uppercase border-primary/20 bg-primary/5 text-primary backdrop-blur-md">
                <Gavel className="w-3.5 h-3.5 mr-1.5 inline-block" />
                Disciplinary & Grievance
              </Badge>
              <Badge variant="neutral" className="px-3 py-1 font-medium tracking-wide border-muted-foreground/20 bg-muted/50 text-muted-foreground backdrop-blur-md">
                <ShieldCheck className="w-3.5 h-3.5 mr-1.5 inline-block" />
                Confidential Workspace
              </Badge>
            </div>
            
            <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground">
              Complaints <span className="text-transparent bg-clip-text bg-gradient-to-br from-primary via-primary/90 to-primary/60">Management</span>
            </h1>
            
            <p className="text-muted-foreground text-base md:text-lg leading-relaxed font-medium">
              Review, evaluate, and resolve student and staff grievances. All cases are handled with strict confidentiality to ensure a fair and transparent resolution process across the university.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Badge variant="neutral" className="bg-background/80 backdrop-blur-sm border-border/60 text-sm py-1.5 px-3 shadow-sm">
                <FileText className="w-4 h-4 mr-2 inline-block text-primary/70" />
                {complaints.length} Total Complaints
              </Badge>
              {activeCount > 0 && (
                <Badge variant="neutral" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 text-sm py-1.5 px-3 shadow-sm">
                  <AlertTriangle className="w-4 h-4 mr-2 inline-block" />
                  {activeCount} Active Review(s)
                </Badge>
              )}
            </div>
          </div>
        </section>

        {/* FILTERS */}
        <FilterCard resetHref="/dashboard/complaints">
          <Field label="Target Initiative">
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
          <Field label="Review Stage">
            <Select
              name="state"
              defaultValue={state ?? ""}
              options={[
                { value: "", label: "All Stages" },
                { value: "SUBMITTED", label: "Newly Submitted" },
                { value: "UNDER_REVIEW", label: "Under Review" },
                { value: "ROUTED", label: "Routed" },
                { value: "ESCALATED", label: "Escalated" },
                { value: "RESOLVED", label: "Resolved" },
                { value: "CLOSED", label: "Closed" },
              ]}
            />
          </Field>
          <Field label="Search Records">
            <Input
              name="search"
              defaultValue={search ?? ""}
              placeholder="Search by subject, student, or initiative"
            />
          </Field>
        </FilterCard>

        {/* WORKSPACE */}
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.2fr)_460px] items-start">
          
          {/* COMPLAINTS QUEUE TABLE */}
          <Card className="border-border/40 shadow-sm bg-background/40 backdrop-blur-xl overflow-hidden flex flex-col h-full">
            <CardHeader className="border-b border-border/30 bg-muted/10 pb-5">
              <CardTitle className="text-xl tracking-tight">Review Queue</CardTitle>
              <CardDescription>Select a complaint to inspect details and manage the resolution process.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {complaints.length === 0 ? (
                <div className="p-12">
                  <StatePanel
                    icon={SearchSlash}
                    title="No Matching Records"
                    description="No complaints match the current filters."
                    tone="empty"
                  />
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="font-semibold text-muted-foreground tracking-wider uppercase text-xs h-12 px-6">Subject</TableHead>
                      <TableHead className="font-semibold text-muted-foreground tracking-wider uppercase text-xs h-12">Initiative</TableHead>
                      <TableHead className="font-semibold text-muted-foreground tracking-wider uppercase text-xs h-12">Submitted By</TableHead>
                      <TableHead className="font-semibold text-muted-foreground tracking-wider uppercase text-xs h-12 text-center">Stage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {complaints.map((complaint) => {
                      const isSelected = complaint.id === selectedComplaintId;
                      return (
                        <TableRow
                          key={complaint.id}
                          className={`transition-colors ${isSelected ? "bg-primary/5 hover:bg-primary/10 border-l-2 border-l-primary" : "hover:bg-muted/30 border-l-2 border-l-transparent"}`}
                        >
                          <TableCell className="align-top px-6 py-4">
                            <Link
                              href={`${buildRelativeHref("/dashboard/complaints", params, { complaintId: complaint.id })}#details-panel`}
                              className={`font-bold transition-colors ${isSelected ? "text-primary" : "text-foreground hover:text-primary"}`}
                              aria-current={isSelected ? "page" : undefined}
                            >
                              {complaint.subject}
                            </Link>
                            <div className="mt-1 flex items-center gap-1 text-[10px] uppercase tracking-widest font-mono text-muted-foreground">
                              <ShieldCheck className="w-3 h-3" /> {complaint.evidenceCount} attached item(s)
                            </div>
                          </TableCell>
                          <TableCell className="text-sm font-medium">{complaint.event?.title ?? <span className="italic text-muted-foreground">General Report</span>}</TableCell>
                          <TableCell className="text-sm">{complaint.submittedBy?.fullName ?? "Unknown Submitter"}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={getComplaintStateTone(complaint.state)} className="text-[10px] uppercase tracking-widest px-2 py-0.5">
                              {formatEnumLabel(complaint.state)}
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
            {selectedComplaint ? (
              <div key={selectedComplaint.id} className="space-y-6">
                
                {/* COMPLAINT DETAIL CARD */}
                <Card className="border-border/50 shadow-sm bg-background/50 backdrop-blur-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-6 opacity-[0.02] pointer-events-none">
                    <FileWarning className="w-40 h-40" />
                  </div>
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Badge variant={getComplaintStateTone(selectedComplaint.state)} className="text-xs uppercase tracking-widest px-2 py-1 shadow-sm">
                        {formatEnumLabel(selectedComplaint.state)}
                      </Badge>
                      <Badge variant="neutral" className="text-xs uppercase tracking-widest px-2 py-1">
                        {selectedComplaint.event?.title ?? "General University Report"}
                      </Badge>
                    </div>
                    <CardTitle className="text-2xl tracking-tight">Complaint Details</CardTitle>
                    <CardDescription className="text-muted-foreground font-mono text-xs mt-1">
                      Reference ID: {selectedComplaint.id}
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent className="space-y-5">
                    {/* SUBJECT & DESCRIPTION */}
                    <div className="rounded-xl border border-border/50 bg-background/80 p-5 shadow-sm">
                      <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-3">
                        <FileText className="h-3 w-3" /> Complaint Description
                      </div>
                      <div className="text-base font-bold text-foreground">
                        {selectedComplaint.subject}
                      </div>
                      <div className="mt-3 text-sm leading-relaxed text-muted-foreground font-light whitespace-pre-wrap">
                        {selectedComplaint.description}
                      </div>
                    </div>

                    {/* REPORTER INFO */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-border/50 bg-background/80 p-4 shadow-sm">
                        <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-3">
                          <UserMinus className="h-3 w-3" /> Submitted By
                        </div>
                        <div className="font-bold text-sm text-foreground">
                          {selectedComplaint.submittedBy?.fullName ?? "Unknown Submitter"}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground font-mono truncate">
                          {selectedComplaint.submittedBy?.email ?? "No email available"}
                        </div>
                      </div>
                      <div className="rounded-xl border border-border/50 bg-background/80 p-4 shadow-sm">
                        <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-3">
                          <AlertTriangle className="h-3 w-3" /> Date Filed
                        </div>
                        <div className="font-mono text-sm text-foreground mt-2">
                          {formatDateTime(selectedComplaint.createdAt)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* EVIDENCE & ROUTING */}
                <div className="rounded-xl border border-border/40 overflow-hidden bg-background/20 backdrop-blur-sm">
                  <div className="bg-muted/30 px-4 py-3 border-b border-border/40 text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" /> Confidential Records
                  </div>
                  <div className="p-4 space-y-6">
                    <SupportingDocumentList
                      documents={selectedComplaint.evidence}
                      title="Supporting Evidence"
                      emptyMessage="No evidence files were attached during submission."
                    />
                    <ComplaintRoutingCard routingHistory={selectedComplaint.routingHistory} />
                    <ComplaintWorkflowPanel complaintId={selectedComplaint.id} />
                  </div>
                </div>
              </div>
            ) : (
              <Card className="border-border/40 bg-background/50 backdrop-blur-xl shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-[0.02] pointer-events-none">
                  <ShieldAlert className="w-24 h-24" />
                </div>
                <CardHeader>
                  <Badge variant="neutral" className="w-fit mb-3 text-xs uppercase tracking-widest px-2 py-1">Private Workspace</Badge>
                  <CardTitle className="text-xl tracking-tight">Select a Complaint</CardTitle>
                  <CardDescription className="text-muted-foreground leading-relaxed mt-2">
                    Select a complaint from the queue to view its details, review attached evidence, and process routing actions securely.
                  </CardDescription>
                </CardHeader>
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
            title="Access Denied"
            description="Access to the complaints management system is restricted to authorized university administrators and review board members."
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
              : "An unexpected error disrupted the connection to the complaints ledger."
          }
          tone="error"
        />
      </div>
    );
  }
}