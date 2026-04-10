import Link from "next/link";
import { AlertTriangle, SearchSlash, ShieldAlert } from "lucide-react";

import { getAuditLog, listAuditLogs } from "@/lib/api/internal";
import { buildRelativeHref } from "@/lib/detail-query";
import { ApiError } from "@/lib/api/shared";
import { formatDateTime } from "@/lib/format";
import { FilterCard } from "@/components/internal/filter-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
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
      <>
        <PageHeader
          eyebrow="Audit"
          title="Inspect the protected trace behind sensitive actions"
          description="Audit views are role-gated and internal only. They expose actor identity, request context, and route-level evidence for teacher review and system integrity checks."
          action={
            <div className="flex flex-wrap gap-2">
              <Badge variant="warning">System admin only</Badge>
              <Badge variant="info">{logs.length} visible log(s)</Badge>
            </div>
          }
        />

        <FilterCard resetHref="/dashboard/audit">
          <Field label="Actor ID">
            <Input name="actorId" defaultValue={actorId ?? ""} placeholder="Filter by actor id" />
          </Field>
          <Field label="Entity type">
            <Input
              name="entityType"
              defaultValue={entityType ?? ""}
              placeholder="User, ReconciliationReport, PaymentProof"
            />
          </Field>
          <Field label="Entity ID">
            <Input
              name="entityId"
              defaultValue={entityId ?? ""}
              placeholder="Specific entity id"
            />
          </Field>
          <Field label="Limit">
            <Input name="limit" type="number" min="1" max="100" defaultValue={limit} />
          </Field>
        </FilterCard>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_420px]">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Protected audit log</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {logs.length === 0 ? (
                <StatePanel
                  icon={SearchSlash}
                  title="No audit logs match this filter set"
                  description="Adjust the filters to inspect a wider part of the protected action history."
                  tone="empty"
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Action</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow
                        key={log.id}
                        data-state={log.id === selectedAuditLogId ? "selected" : undefined}
                      >
                        <TableCell className="align-top">
                          <Link
                            href={buildRelativeHref("/dashboard/audit", params, {
                              auditLogId: log.id,
                            })}
                            className={
                              log.id === selectedAuditLogId
                                ? "focus-ring rounded-sm font-semibold text-primary"
                                : "focus-ring rounded-sm font-semibold text-foreground hover:text-primary hover:underline"
                            }
                            aria-current={log.id === selectedAuditLogId ? "page" : undefined}
                          >
                            {log.action}
                          </Link>
                          <div className="mt-1 text-xs text-muted-foreground">{log.summary}</div>
                        </TableCell>
                        <TableCell>
                          {log.entityType}
                          {log.entityId ? (
                            <div className="mt-1 text-xs text-muted-foreground">{log.entityId}</div>
                          ) : null}
                        </TableCell>
                        <TableCell>{log.actor?.fullName ?? "System"}</TableCell>
                        <TableCell>{formatDateTime(log.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            {selectedLog ? (
              <div key={selectedLog.id} className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl">Selected audit detail</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-0">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="warning">{selectedLog.action}</Badge>
                      <Badge variant="neutral">{selectedLog.entityType}</Badge>
                    </div>
                    <div className="rounded-[1rem] border border-border/70 bg-panel-muted px-4 py-4 text-sm leading-6 text-muted-foreground">
                      <div className="data-kicker">Summary</div>
                      <div className="mt-2 text-foreground">{selectedLog.summary}</div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-[1rem] border border-border/70 bg-panel px-4 py-4 text-sm leading-6 text-muted-foreground">
                        <div className="data-kicker">Actor</div>
                        <div className="mt-2 text-foreground">
                          {selectedLog.actor?.fullName ?? "System"}
                        </div>
                        <div className="mt-1">
                          {selectedLog.actor?.email ?? "No actor email available"}
                        </div>
                      </div>
                      <div className="rounded-[1rem] border border-border/70 bg-panel px-4 py-4 text-sm leading-6 text-muted-foreground">
                        <div className="data-kicker">Route</div>
                        <div className="mt-2 text-foreground">
                          {selectedLog.method ?? "N/A"} {selectedLog.route ?? "No route recorded"}
                        </div>
                        <div className="mt-1">{formatDateTime(selectedLog.createdAt)}</div>
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-[1rem] border border-border/70 bg-panel px-4 py-4 text-sm leading-6 text-muted-foreground">
                        <div className="data-kicker">IP address</div>
                        <div className="mt-2 text-foreground">
                          {selectedLog.ipAddress ?? "Not recorded"}
                        </div>
                      </div>
                      <div className="rounded-[1rem] border border-border/70 bg-panel px-4 py-4 text-sm leading-6 text-muted-foreground">
                        <div className="data-kicker">User agent</div>
                        <div className="mt-2 break-words text-foreground">
                          {selectedLog.userAgent ?? "Not recorded"}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl">Context payload</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <pre className="overflow-x-auto rounded-[1rem] border border-border/70 bg-panel-muted p-4 text-xs leading-6 text-muted-foreground">
                      {selectedLog.context
                        ? JSON.stringify(selectedLog.context, null, 2)
                        : "No additional context was recorded for this log."}
                    </pre>
                  </CardContent>
                  </Card>
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
          title="This account cannot access protected audit views"
          description="The live backend limits audit access to system administrators only."
          tone="warning"
        />
      );
    }

    return (
      <StatePanel
        icon={AlertTriangle}
        title="Audit views could not be loaded"
        description={
          error instanceof ApiError
            ? error.message
            : "The live backend could not prepare the protected audit workspace."
        }
        tone="error"
      />
    );
  }
}
