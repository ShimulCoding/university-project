import {
  approvalQueueRows,
  dashboardMetrics,
  internalSignals,
  verificationQueueRows,
} from "@/features/foundation/data/demo-content";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function DashboardOverviewPage() {
  return (
    <>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {dashboardMetrics.map((metric) => (
          <Card key={metric.label}>
            <div className="data-kicker">{metric.label}</div>
            <div className="mt-4 text-3xl font-semibold text-primary">{metric.value}</div>
            <div className="mt-3 text-sm leading-6 text-muted-foreground">{metric.detail}</div>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <Badge variant="warning">Finance review queue</Badge>
            <CardTitle className="mt-3">Payment verification posture</CardTitle>
            <CardDescription>
              Finance-side review focuses on participant context and proof presence
              without exposing that material in public pages.
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                {verificationQueueRows.map((row) => (
                  <TableRow key={`${row.participant}-${row.event}`}>
                    <TableCell className="font-semibold text-foreground">
                      {row.participant}
                    </TableCell>
                    <TableCell>{row.event}</TableCell>
                    <TableCell>{row.channel}</TableCell>
                    <TableCell>{row.amount}</TableCell>
                    <TableCell>
                      <Badge variant="warning">{row.state}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Badge variant="info">Approval posture</Badge>
            <CardTitle className="mt-3">Decision queue readiness</CardTitle>
            <CardDescription>
              Request review emphasizes identity, status, and clear transition control
              while preventing self-approval.
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                {approvalQueueRows.map((row) => (
                  <TableRow key={`${row.entityType}-${row.event}`}>
                    <TableCell className="font-semibold text-foreground">
                      {row.entityType}
                    </TableCell>
                    <TableCell>{row.event}</TableCell>
                    <TableCell>{row.amount}</TableCell>
                    <TableCell>
                      <Badge variant="info">{row.state}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-5 space-y-3">
              {approvalQueueRows.map((row) => (
                <div
                  key={row.note}
                  className="rounded-[1.15rem] border border-border/70 bg-panel-muted px-4 py-4 text-sm leading-6 text-muted-foreground"
                >
                  {row.note}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        {internalSignals.map((signal) => (
          <Card key={signal.title} tone="muted">
            <CardHeader>
              <CardTitle>{signal.title}</CardTitle>
              <CardDescription>{signal.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>
    </>
  );
}
