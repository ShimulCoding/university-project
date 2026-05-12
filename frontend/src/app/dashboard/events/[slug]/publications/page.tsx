import { SearchSlash } from "lucide-react";
import { getCurrentUser } from "@/lib/api/student";
import { listReconciliationReports } from "@/lib/api/internal";
import { apiFetchServer } from "@/lib/api/server";
import { formatEnumLabel, formatMoney, formatDateTime } from "@/lib/format";
import type { ManagedEvent } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatePanel } from "@/components/ui/state-panel";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function EventPublicationsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) return null;
  let event: ManagedEvent | null = null;
  try { const res = await apiFetchServer<{ event: ManagedEvent }>(`/events/manage/${slug}`); event = res.event; } catch { return null; }
  if (!event) return null;

  const reports = await listReconciliationReports({ eventId: event.id, status: "FINALIZED" }).catch(() => []);

  return (
    <div className="flex flex-col gap-8 pb-16">
      <section className="relative overflow-hidden rounded-3xl border border-border/20 bg-background/50 shadow-xl backdrop-blur-3xl px-8 py-8">
        <h1 className="text-3xl font-black tracking-tight">Publications</h1>
        <p className="mt-2 text-muted-foreground text-lg font-light">Public-safe financial summaries for {event.title}.</p>
        <Badge variant="neutral" className="mt-3">{reports.length} finalized report(s)</Badge>
      </section>
      <Card className="border-border/40 shadow-xl bg-background/40 backdrop-blur-xl overflow-hidden">
        <CardHeader className="border-b border-border/30 bg-muted/10"><CardTitle>Finalized Reports</CardTitle></CardHeader>
        <CardContent className="p-0">
          {reports.length === 0 ? (
            <div className="p-12"><StatePanel icon={SearchSlash} tone="empty" title="No finalized reports" description="No reconciliation reports have been finalized for publication for this event." /></div>
          ) : (
            <Table><TableHeader className="bg-muted/30"><TableRow><TableHead className="font-semibold text-xs uppercase tracking-wider px-6 h-12">Status</TableHead><TableHead className="font-semibold text-xs uppercase tracking-wider h-12">Income</TableHead><TableHead className="font-semibold text-xs uppercase tracking-wider h-12">Expense</TableHead><TableHead className="font-semibold text-xs uppercase tracking-wider h-12">Balance</TableHead><TableHead className="font-semibold text-xs uppercase tracking-wider h-12">Created</TableHead></TableRow></TableHeader>
            <TableBody>{reports.map((r) => (<TableRow key={r.id} className="hover:bg-muted/20"><TableCell className="px-6 py-4"><Badge variant="success" className="text-[10px] uppercase tracking-widest">{formatEnumLabel(r.status)}</Badge></TableCell><TableCell className="font-mono">{formatMoney(r.totalIncome)}</TableCell><TableCell className="font-mono">{formatMoney(r.totalExpense)}</TableCell><TableCell className="font-mono font-bold">{formatMoney(r.closingBalance)}</TableCell><TableCell className="text-sm text-muted-foreground">{formatDateTime(r.createdAt)}</TableCell></TableRow>))}</TableBody></Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
