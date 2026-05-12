import { SearchSlash } from "lucide-react";
import { getCurrentUser } from "@/lib/api/student";
import { listExpenseRecords } from "@/lib/api/internal";
import { apiFetchServer } from "@/lib/api/server";
import { formatEnumLabel, formatMoney } from "@/lib/format";
import type { ManagedEvent } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatePanel } from "@/components/ui/state-panel";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function EventExpenseRecordsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) return null;
  let event: ManagedEvent | null = null;
  try { const res = await apiFetchServer<{ event: ManagedEvent }>(`/events/manage/${slug}`); event = res.event; } catch { return null; }
  if (!event) return null;
  const records = await listExpenseRecords({ eventId: event.id }).catch(() => []);

  return (
    <div className="flex flex-col gap-8 pb-16">
      <section className="relative overflow-hidden rounded-3xl border border-border/20 bg-background/50 shadow-xl backdrop-blur-3xl px-8 py-8">
        <h1 className="text-3xl font-black tracking-tight">Expense Records</h1>
        <p className="mt-2 text-muted-foreground text-lg font-light">Settled expenditures for {event.title}.</p>
        <Badge variant="neutral" className="mt-3">{records.length} record(s)</Badge>
      </section>
      <Card className="border-border/40 shadow-xl bg-background/40 backdrop-blur-xl overflow-hidden">
        <CardHeader className="border-b border-border/30 bg-muted/10"><CardTitle>Expense Records</CardTitle></CardHeader>
        <CardContent className="p-0">
          {records.length === 0 ? (
            <div className="p-12"><StatePanel icon={SearchSlash} tone="empty" title="No expense records" description="No settled expenses recorded for this event." /></div>
          ) : (
            <Table><TableHeader className="bg-muted/30"><TableRow><TableHead className="font-semibold text-xs uppercase tracking-wider px-6 h-12">Description</TableHead><TableHead className="font-semibold text-xs uppercase tracking-wider h-12">Amount</TableHead><TableHead className="font-semibold text-xs uppercase tracking-wider h-12">Category</TableHead><TableHead className="font-semibold text-xs uppercase tracking-wider h-12">State</TableHead></TableRow></TableHeader>
            <TableBody>{records.map((rec) => (<TableRow key={rec.id} className="hover:bg-muted/20"><TableCell className="px-6 py-4 font-bold">{rec.description}</TableCell><TableCell className="font-mono">{formatMoney(rec.amount)}</TableCell><TableCell>{rec.category}</TableCell><TableCell><Badge variant="neutral" className="text-[10px] uppercase tracking-widest">{formatEnumLabel(rec.state)}</Badge></TableCell></TableRow>))}</TableBody></Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
