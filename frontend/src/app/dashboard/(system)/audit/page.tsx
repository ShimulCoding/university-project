import Link from "next/link";
import { AlertTriangle, SearchSlash, ShieldAlert, Fingerprint, Activity, TerminalSquare, UserCheck, Globe, Database, HardDrive } from "lucide-react";

import { getAuditLog, listAuditLogs } from "@/lib/api/internal";
import { buildRelativeHref } from "@/lib/detail-query";
import { ApiError } from "@/lib/api/shared";
import { formatDateTime } from "@/lib/format";
import { FilterCard } from "@/components/internal/filter-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const actorId = typeof params.actorId === "string" ? params.actorId : undefined;
  const entityType = typeof params.entityType === "string" ? params.entityType : undefined;
  const entityId = typeof params.entityId === "string" ? params.entityId : undefined;
  const auditLogId = typeof params.auditLogId === "string" ? params.auditLogId : undefined;
  const limit = typeof params.limit === "string" ? params.limit : "20";

  try {
    const logs = await listAuditLogs({ actorId, entityType, entityId, limit });
    const selectedAuditLogId = logs.find((log) => log.id === auditLogId)?.id ?? logs[0]?.id;
    const selectedLog = selectedAuditLogId ? await getAuditLog(selectedAuditLogId) : null;

    return (
      <div className="flex flex-col gap-8 pb-16">
        {/* HERO SECTION */}
        <section className="relative overflow-hidden rounded-3xl border border-border/20 bg-background/50 shadow-2xl shadow-black/5 backdrop-blur-3xl px-8 py-10 lg:px-12 lg:py-12">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
          <div className="absolute bottom-0 right-0 -z-10 m-auto h-[300px] w-[300px] rounded-full bg-foreground/5 opacity-60 blur-[100px] pointer-events-none translate-x-1/4 translate-y-1/4" />
          
          <div className="relative z-10 flex flex-col gap-6 max-w-3xl">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="neutral" className="px-3 py-1 font-semibold tracking-wider uppercase border-border/50 bg-background/50 text-foreground backdrop-blur-md">
                <Fingerprint className="w-3 h-3 mr-1.5 inline-block" />
                System Integrity Log
              </Badge>
              <Badge variant="warning" className="px-3 py-1 font-semibold tracking-wider uppercase border-warning/30 bg-warning/10 text-warning backdrop-blur-md">
                Administrator Access
              </Badge>
            </div>
            
            <h1 className="text-3xl lg:text-5xl font-black tracking-tight text-foreground">
              Security <span className="text-transparent bg-clip-text bg-gradient-to-br from-foreground via-foreground/70 to-foreground/40">Audit Trail</span>
            </h1>
            
            <p className="text-muted-foreground text-lg leading-relaxed font-light">
              Inspect protected cryptographic traces of all sensitive system mutations. This role-gated ledger exposes actor identities, request signatures, and contextual payloads for zero-trust integrity verification.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Badge variant="info" className="bg-background/50 backdrop-blur-sm border-info/30 text-sm py-1.5 text-info">
                <Activity className="w-4 h-4 mr-2 inline-block" />
                {logs.length} Trace(s) Captured
              </Badge>
            </div>
          </div>
        </section>

        {/* FILTERS */}
        <FilterCard resetHref="/dashboard/audit">
          <Field label="Actor Signature">
            <Input name="actorId" defaultValue={actorId ?? ""} placeholder="Filter by actor ID" />
          </Field>
          <Field label="Entity Class">
            <Input
              name="entityType"
              defaultValue={entityType ?? ""}
              placeholder="e.g. ReconciliationReport, PaymentProof"
            />
          </Field>
          <Field label="Entity Identifier">
            <Input
              name="entityId"
              defaultValue={entityId ?? ""}
              placeholder="Specific resource UUID"
            />
          </Field>
          <Field label="Capture Limit">
            <Input name="limit" type="number" min="1" max="100" defaultValue={limit} />
          </Field>
        </FilterCard>

        {/* WORKSPACE */}
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.15fr)_460px] items-start">
          
          {/* LOG QUEUE TABLE */}
          <Card className="border-border/40 shadow-xl shadow-black/5 bg-background/40 backdrop-blur-xl overflow-hidden flex flex-col h-full">
            <CardHeader className="border-b border-border/30 bg-muted/10 pb-5">
              <CardTitle className="text-xl tracking-tight">Protected Trace Ledger</CardTitle>
              <CardDescription>Select an event to inspect its cryptographic signature, network origin, and state payload.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {logs.length === 0 ? (
                <div className="p-12">
                  <StatePanel
                    icon={SearchSlash}
                    title="No Matching Signatures"
                    description="No system logs match the current forensic filters."
                    tone="empty"
                  />
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="font-semibold text-muted-foreground tracking-wider uppercase text-xs h-12 px-6">Operation</TableHead>
                      <TableHead className="font-semibold text-muted-foreground tracking-wider uppercase text-xs h-12">Resource Target</TableHead>
                      <TableHead className="font-semibold text-muted-foreground tracking-wider uppercase text-xs h-12">Authorized Actor</TableHead>
                      <TableHead className="font-semibold text-muted-foreground tracking-wider uppercase text-xs h-12 text-right">Timestamp</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => {
                      const isSelected = log.id === selectedAuditLogId;
                      return (
                        <TableRow
                          key={log.id}
                          className={`transition-colors ${isSelected ? "bg-foreground/5 hover:bg-foreground/10 border-l-2 border-l-foreground" : "hover:bg-muted/30 border-l-2 border-l-transparent"}`}
                        >
                          <TableCell className="align-top px-6 py-4">
                            <Link
                              href={`${buildRelativeHref("/dashboard/audit", params, { auditLogId: log.id })}#details-panel`}
                              className={`font-bold transition-colors ${isSelected ? "text-foreground" : "text-foreground hover:opacity-70"}`}
                              aria-current={isSelected ? "page" : undefined}
                            >
                              {log.action}
                            </Link>
                            <div className="mt-1 text-xs text-muted-foreground line-clamp-1">{log.summary}</div>
                          </TableCell>
                          <TableCell className="align-top py-4">
                            <span className="font-mono text-[11px] font-bold tracking-widest text-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                              {log.entityType}
                            </span>
                            {log.entityId && (
                              <div className="mt-1 text-[10px] font-mono text-muted-foreground tracking-wider opacity-70">
                                {log.entityId.substring(0, 13)}...
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-sm font-medium">{log.actor?.fullName ?? "System Process"}</TableCell>
                          <TableCell className="text-right text-xs font-mono text-muted-foreground">
                            {formatDateTime(log.createdAt)}
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
            {selectedLog ? (
              <div key={selectedLog.id} className="space-y-6">
                
                {/* LOG DETAIL CARD */}
                <Card className="border-border/40 shadow-xl shadow-black/5 bg-background/50 backdrop-blur-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none">
                    <TerminalSquare className="w-40 h-40" />
                  </div>
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Badge variant="warning" className="text-xs font-mono uppercase tracking-widest px-2 py-1 shadow-sm">
                        {selectedLog.action}
                      </Badge>
                      <Badge variant="neutral" className="text-xs uppercase tracking-widest px-2 py-1 bg-muted/50">
                        {selectedLog.entityType}
                      </Badge>
                    </div>
                    <CardTitle className="text-2xl tracking-tight">Forensic Detail</CardTitle>
                    <CardDescription className="text-foreground/70 font-mono text-xs mt-1 truncate">
                      ID: {selectedLog.id}
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent className="space-y-5">
                    {/* SUMMARY */}
                    <div className="rounded-xl border border-border/50 bg-background/80 p-5 shadow-sm">
                      <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-2">
                        Execution Summary
                      </div>
                      <div className="text-sm font-medium text-foreground leading-relaxed">
                        {selectedLog.summary}
                      </div>
                    </div>

                    {/* IDENTITY & ROUTE GRID */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-border/50 bg-background/80 p-4 shadow-sm">
                        <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-3">
                          <UserCheck className="h-3 w-3" /> Principal Actor
                        </div>
                        <div className="font-bold text-sm text-foreground">
                          {selectedLog.actor?.fullName ?? "System Automaton"}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground font-mono">
                          {selectedLog.actor?.email ?? "No binding email"}
                        </div>
                      </div>
                      <div className="rounded-xl border border-border/50 bg-background/80 p-4 shadow-sm">
                        <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-3">
                          <Database className="h-3 w-3" /> Execution Context
                        </div>
                        <div className="font-bold text-sm text-foreground font-mono">
                          {selectedLog.method ?? "N/A"} <span className="font-normal text-muted-foreground">{selectedLog.route ?? "No route"}</span>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground font-mono">
                          {formatDateTime(selectedLog.createdAt)}
                        </div>
                      </div>
                    </div>

                    {/* NETWORK ORIGIN GRID */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-border/50 bg-muted/30 p-4 shadow-sm">
                        <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-2">
                          <Globe className="h-3 w-3" /> Source IP Vector
                        </div>
                        <div className="font-mono text-xs text-foreground mt-2">
                          {selectedLog.ipAddress ?? "Masked / Not recorded"}
                        </div>
                      </div>
                      <div className="rounded-xl border border-border/50 bg-muted/30 p-4 shadow-sm">
                        <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-2">
                          <HardDrive className="h-3 w-3" /> User Agent Fingerprint
                        </div>
                        <div className="font-mono text-[10px] text-foreground mt-2 break-words leading-relaxed">
                          {selectedLog.userAgent ?? "Masked / Not recorded"}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* PAYLOAD INSPECTOR */}
                <Card className="border-border/40 shadow-xl shadow-black/5 bg-background/50 backdrop-blur-xl relative overflow-hidden">
                  <CardHeader className="pb-3 border-b border-border/30">
                    <CardTitle className="text-lg tracking-tight">State Mutation Payload</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <pre className="overflow-x-auto rounded-xl border border-border/50 bg-muted/50 p-4 text-[11px] font-mono leading-relaxed text-foreground/80 shadow-inner">
                      {selectedLog.context
                        ? JSON.stringify(selectedLog.context, null, 2)
                        : "// No extended state payload captured for this execution."}
                    </pre>
                  </CardContent>
                </Card>
              </div>
            ) : null}
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
            description="The live backend explicitly denies audit ledger access to all sessions lacking System Administrator credentials."
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
              : "An unexpected error disrupted the connection to the protected audit ledger."
          }
          tone="error"
        />
      </div>
    );
  }
}
