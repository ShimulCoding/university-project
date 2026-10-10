import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { getCurrentUser } from "@/lib/api/student";
import { getEventRolesForEvent, isSystemAdmin } from "@/lib/access";
import { apiFetchServer } from "@/lib/api/server";
import { queryPage } from "@/lib/api/list";
import { getBudgetRequest } from "@/lib/api/internal";
import { formatEnumLabel, formatMoney, getRequestStateTone } from "@/lib/format";
import type { BudgetRequestRecord, ManagedEvent } from "@/types";
import { BudgetRequestForm, RequestEditForm, SubmitRequestButton } from "@/components/internal/requests-actions";
import { DecisionHistoryCard } from "@/components/internal/decision-history-card";
import { SupportingDocumentList } from "@/components/internal/supporting-document-list";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatePanel } from "@/components/ui/state-panel";
import { PageHeader } from "@/components/ui/page-header";

export default async function FundingRequestsPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const page = queryPage(query.page);
  const user = await getCurrentUser();
  if (!user) return null;
  try {
    const { event } = await apiFetchServer<{ event: ManagedEvent }>(`/events/manage/${slug}`);
    const roles = getEventRolesForEvent(user, event.id);
    if (!isSystemAdmin(user) && !roles.some((role) => ["EVENT_ADMIN", "EVENT_MANAGEMENT_USER", "FINANCIAL_CONTROLLER", "ORGANIZATIONAL_APPROVER"].includes(role))) {
      return <StatePanel icon={ShieldAlert} tone="warning" title="Access restricted" description="Your role in this event does not include finance requests." />;
    }
    const { budgetRequests: requests, pagination } = await apiFetchServer<{ budgetRequests: BudgetRequestRecord[]; pagination: { totalPages: number } }>("/requests/budget-requests", { query: { eventId: event.id, page, pageSize: "20" } });
    const requestedId = typeof query.requestId === "string" ? query.requestId : undefined;
    const selectedId = requests.find((request) => request.id === requestedId)?.id ?? requests[0]?.id;
    const selected = selectedId ? await getBudgetRequest(selectedId) : null;
    const canCreate = roles.includes("EVENT_ADMIN") || roles.includes("EVENT_MANAGEMENT_USER");
    const canEdit = canCreate && selected?.requestedBy?.id === user.id && (selected.state === "DRAFT" || selected.state === "RETURNED");
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Event funding" title="Funding requests" description={`Request additional funding for ${event.title} and follow its decision history. Your event’s Approver reviews submitted requests.`} />
        <div className="grid gap-6 xl:grid-cols-2">
          <Card><CardHeader><CardTitle>Requests</CardTitle></CardHeader><CardContent className="space-y-3">
            {requests.length === 0 ? <p className="text-sm text-muted-foreground">No funding requests for this event.</p> : null}
            {requests.map((request) => <Link key={request.id} href={`/dashboard/events/${slug}/funding-requests?page=${page}&requestId=${request.id}`} className={`block rounded-xl border p-4 ${request.id === selectedId ? "border-primary" : "border-border"}`}><div className="font-semibold">{request.purpose}</div><div className="mt-2 flex justify-between gap-3"><span>{formatMoney(request.amount)}</span><Badge variant={getRequestStateTone(request.state)}>{formatEnumLabel(request.state)}</Badge></div></Link>)}
            <div className="flex gap-3">{Number(page) > 1 ? <Button asChild size="sm" variant="outline"><Link href={`/dashboard/events/${slug}/funding-requests?page=${Number(page) - 1}`}>Previous</Link></Button> : null}{Number(page) < pagination.totalPages ? <Button asChild size="sm" variant="outline"><Link href={`/dashboard/events/${slug}/funding-requests?page=${Number(page) + 1}`}>Next</Link></Button> : null}</div>
          </CardContent></Card>
          {selected ? <div className="space-y-4">
            <Card><CardHeader><CardTitle>{selected.purpose}</CardTitle><CardDescription>Requested by {selected.requestedBy?.fullName ?? "Unknown"}</CardDescription></CardHeader><CardContent><p>{formatMoney(selected.amount)}</p><p className="mt-3 text-sm text-muted-foreground">{selected.justification}</p></CardContent></Card>
            <SupportingDocumentList documents={selected.documents} />
            <DecisionHistoryCard decisions={selected.approvalDecisions} />
            {canEdit ? <><RequestEditForm key={selected.id + selected.updatedAt} request={selected} kind="budget-requests" /><SubmitRequestButton endpoint={`/requests/budget-requests/${selected.id}/submit`} label="Funding request" /></> : null}
          </div> : null}
        </div>
        {canCreate ? <BudgetRequestForm events={[event]} /> : null}
      </div>
    );
  } catch {
    return <StatePanel icon={ShieldAlert} tone="error" title="Unable to load funding requests" description="Check your event assignment and try reloading the page." />;
  }
}
