import { redirect } from "next/navigation";
import { BadgeCheck, SearchSlash } from "lucide-react";

import { getCurrentUser } from "@/lib/api/student";
import { getEventRolesForEvent, isSystemAdmin } from "@/lib/access";
import { listPaymentVerificationQueue } from "@/lib/api/internal";
import { apiFetchServer } from "@/lib/api/server";
import { formatEnumLabel, getPaymentStateTone } from "@/lib/format";
import type { ManagedEvent } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

async function getEventBySlug(slug: string) {
  try {
    const response = await apiFetchServer<{ event: ManagedEvent }>(`/events/manage/${slug}`);
    return response.event;
  } catch {
    return null;
  }
}

export default async function EventPaymentsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [user, event] = await Promise.all([getCurrentUser(), getEventBySlug(slug)]);

  if (!user || !event) return null;

  const eventRoles = isSystemAdmin(user) ? ["SYSTEM_ADMIN" as const] : getEventRolesForEvent(user, event.id);
  const canSeeFinance = isSystemAdmin(user) || eventRoles.includes("FINANCIAL_CONTROLLER") || eventRoles.includes("EVENT_ADMIN");

  if (!canSeeFinance) {
    return <StatePanel icon={BadgeCheck} tone="warning" title="Access restricted" description="Your event role does not include payment verification access." />;
  }

  const queue = await listPaymentVerificationQueue({ eventId: event.id }).catch(() => []);

  return (
    <div className="flex flex-col gap-8 pb-16">
      <section className="relative overflow-hidden rounded-3xl border border-border/20 bg-background/50 shadow-xl backdrop-blur-3xl px-8 py-8">
        <h1 className="text-3xl font-black tracking-tight text-foreground">Payment Verification</h1>
        <p className="mt-2 text-muted-foreground text-lg font-light">Review payment proofs submitted for {event.title}.</p>
        <Badge variant="neutral" className="mt-3">{queue.length} item(s) in queue</Badge>
      </section>

      <Card className="border-border/40 shadow-xl bg-background/40 backdrop-blur-xl overflow-hidden">
        <CardHeader className="border-b border-border/30 bg-muted/10"><CardTitle>Verification Queue</CardTitle></CardHeader>
        <CardContent className="p-0">
          {queue.length === 0 ? (
            <div className="p-12"><StatePanel icon={SearchSlash} tone="empty" title="No pending verifications" description="All payment proofs for this event have been processed." /></div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider px-6 h-12">Participant</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider h-12">Channel</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider h-12">Amount</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wider h-12">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queue.map((item) => (
                  <TableRow key={item.id} className="hover:bg-muted/20">
                    <TableCell className="px-6 py-4 font-bold">{item.registration.participantName}</TableCell>
                    <TableCell>{item.externalChannel}</TableCell>
                    <TableCell className="font-mono">{item.amount ?? "N/A"}</TableCell>
                    <TableCell><Badge variant={getPaymentStateTone(item.state) as any} className="text-[10px] uppercase tracking-widest">{formatEnumLabel(item.state)}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
