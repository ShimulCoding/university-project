import { ListPagination } from "@/components/ui/list-pagination";
import { queryPage } from "@/lib/api/list";
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
    const logs = await listAuditLogs({ page: queryPage(params.page), actorId, entityType, entityId, limit });
    const selectedAuditLogId = logs.find((log) => log.id === auditLogId)?.id ?? logs[0]?.id;
    const selectedLog = selectedAuditLogId ? await getAuditLog(selectedAuditLogId) : null;

    return (
      <div className="flex flex-col gap-6 pb-8">
        {/* HERO SECTION */}
        <section className="workspace-intro">



          <div className="relative z-10 flex flex-col gap-6 max-w-3xl">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="neutral" className="px-3 py-1 font-semibold border-border/50 bg-panel text-foreground">
                <Fingerprint className="w-3 h-3 mr-1.5 inline-block" />
                System Integrity Log
              </Badge>
              <Badge variant="warning" className="px-3 py-1 font-semibold border-warning/30 bg-warning/10 text-warning">
                Administrator Access
              </Badge>
            </div>

            <h1 className="text-3xl font-semibold leading-tight tracking-tight text-foreground lg:text-4xl">
              Security <span className="text-success">Audit Trail</span>
            </h1>

            <p className="text-muted-foreground text-lg leading-relaxed font-normal">
              Review who changed platform records, when they acted, and what was recorded. Account and event activity stays available for authorized oversight.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Badge variant="info" className="bg-panel border-info/30 text-sm py-1.5 text-info">
                <Activity className="w-4 h-4 mr-2 inline-block" />
                {logs.length} Trace(s) Captured
              </Badge>
            </div>
          </div>
        </section>

        {/* FILTERS */}
        <FilterCard resetHref="/dashboard/audit">
          <Field label="Account ID">
            <Input name="actorId" defaultValue={actorId ?? ""} placeholder="Filter by actor ID" />
          </Field>
          <Field label="Record type">
            <Input
              name="entityType"
              defaultValue={entityType ?? ""}
              placeholder="e.g. ReconciliationReport, PaymentProof"
            />
          </Field>
          <Field label="Record ID">
            <Input
              name="entityId"
              defaultValue={entityId ?? ""}
              placeholder="Specific resource UUID"
            />
          </Field>
          <Field label="Results per page">
            <Input name="limit" type="number" min="1" max="100" defaultValue={limit} />
          </Field>
        </FilterCard>

        {/* WORKSPACE */}
        <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_360px] items-start">

          {/* LOG QUEUE TABLE */}
          <Card className="border-border/40 shadow-panel bg-panel overflow-hidden flex flex-col h-full">
            <CardHeader className="border-b border-border/30 bg-muted/10 pb-5">
              <CardTitle className="text-xl tracking-tight">Activity history</CardTitle>
              <CardDescription>Select an activity entry to see its account, request details, and recorded changes.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {logs.length === 0 ? (
                <div className="p-12">
                  <StatePanel
                    icon={SearchSlash}
                    title="No matching activity"
                    description="No activity matches your current filters."
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
                            <span className="font-mono text-[11px] font-semibold tracking-widest text-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                              {log.entityType}
                            </span>
                            {log.entityId && (
                              <div className="mt-1 text-xs font-mono text-muted-foreground tracking-wider">
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
                <Card className="border-border/40 shadow-panel bg-panel relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none">
                    <TerminalSquare className="w-40 h-40" />
                  </div>
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Badge variant="warning" className="text-xs font-mono px-2 py-1 shadow-sm">
                        {selectedLog.action}
                      </Badge>
                      <Badge variant="neutral" className="text-xs px-2 py-1 bg-muted/50">
                        {selectedLog.entityType}
                      </Badge>
                    </div>
                    <CardTitle className="text-2xl tracking-tight">Activity details</CardTitle>
                    <CardDescription className="text-foreground/70 font-mono text-xs mt-1 truncate">
                      ID: {selectedLog.id}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-5">
                    {/* SUMMARY */}
                    <div className="rounded-xl border border-border/50 bg-panel p-5 shadow-sm">
                      <div className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-2">
                        Execution Summary
                      </div>
                      <div className="text-sm font-medium text-foreground leading-relaxed">
                        {selectedLog.summary}
                      </div>
                    </div>

                    {/* IDENTITY & ROUTE GRID */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-border/50 bg-panel p-4 shadow-sm">
                        <div className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-3">
                          <UserCheck className="h-3 w-3" /> Principal Actor
                        </div>
                        <div className="font-semibold text-sm text-foreground">
                          {selectedLog.actor?.fullName ?? "System"}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground font-mono">
                          {selectedLog.actor?.email ?? "No binding email"}
                        </div>
                      </div>
                      <div className="rounded-xl border border-border/50 bg-panel p-4 shadow-sm">
                        <div className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-3">
                          <Database className="h-3 w-3" /> Request context
                        </div>
                        <div className="font-semibold text-sm text-foreground font-mono">
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
                        <div className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-2">
                          <Globe className="h-3 w-3" /> Source IP address
                        </div>
                        <div className="break-all font-mono text-xs text-foreground mt-2">
                          {selectedLog.ipAddress ?? "Masked / Not recorded"}
                        </div>
                      </div>
                      <div className="rounded-xl border border-border/50 bg-muted/30 p-4 shadow-sm">
                        <div className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-2">
                          <HardDrive className="h-3 w-3" /> Browser or client
                        </div>
                        <div className="break-all font-mono text-xs text-foreground mt-2 break-words leading-relaxed">
                          {selectedLog.userAgent ?? "Masked / Not recorded"}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* PAYLOAD INSPECTOR */}
                <Card className="border-border/40 shadow-panel bg-panel relative overflow-hidden">
                  <CardHeader className="pb-3 border-b border-border/30">
                    <CardTitle className="text-lg tracking-tight">Recorded changes</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <pre tabIndex={0} role="region" aria-label="Audit record metadata" className="focus-ring overflow-x-auto rounded-xl border border-border/50 bg-muted/50 p-4 text-xs font-mono leading-relaxed text-foreground shadow-inner">
                      {selectedLog.context
                        ? JSON.stringify(selectedLog.context, null, 2)
                        : "No additional details were recorded for this action."}
                    </pre>
                  </CardContent>
                </Card>
              </div>
            ) : null}
          </div>
        </div>
      <ListPagination pagination={logs.pagination} />
        </div>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      return (
        <div className="pt-12">
          <StatePanel
            icon={ShieldAlert}
            title="Access restricted"
            description="Only System Admin accounts can view the platform audit history."
            tone="warning"
          />
        </div>
      );
    }

    return (
      <div className="pt-12">
        <StatePanel
          icon={AlertTriangle}
          title="Unable to load this page"
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
