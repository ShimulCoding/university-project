import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { getCurrentUser } from "@/lib/api/student";
import { isSystemAdmin } from "@/lib/access";
import { apiFetchServer } from "@/lib/api/server";
import { queryPage } from "@/lib/api/list";
import type { UserProfile } from "@/types";
import { formatEnumLabel } from "@/lib/format";
import { AccountActions, AccountCreateForm, type GlobalRoleAssignment } from "@/components/internal/account-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatePanel } from "@/components/ui/state-panel";

export default async function AccountsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const viewer = await getCurrentUser();
  if (!isSystemAdmin(viewer)) return null;
  const params = await searchParams;
  const page = queryPage(params.page);
  const requestedId = typeof params.userId === "string" ? params.userId : undefined;
  try {
    const { users, pagination } = await apiFetchServer<{ users: UserProfile[]; pagination: { totalPages: number; page: number } }>("/users", { query: { page, pageSize: "20" } });
    const selected = users.find((user) => user.id === requestedId) ?? users[0];
    const { assignments } = selected ? await apiFetchServer<{ assignments: GlobalRoleAssignment[] }>(`/roles/assignments/${selected.id}`) : { assignments: [] };
    return (
      <div className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-2">
          <Card><CardHeader><CardTitle>Platform accounts</CardTitle></CardHeader><CardContent className="space-y-3">
            {users.map((user) => <Link key={user.id} href={`/dashboard/users?page=${page}&userId=${user.id}`} className={`block rounded-xl border p-4 ${selected?.id === user.id ? "border-primary" : "border-border"}`}><div className="font-semibold">{user.fullName}</div><div className="text-sm text-muted-foreground">{user.email}</div><Badge className="mt-2">{formatEnumLabel(user.status)}</Badge></Link>)}
            <div className="flex gap-3">{Number(page) > 1 ? <Button asChild size="sm" variant="outline"><Link href={`/dashboard/users?page=${Number(page) - 1}`}>Previous</Link></Button> : null}{Number(page) < pagination.totalPages ? <Button asChild size="sm" variant="outline"><Link href={`/dashboard/users?page=${Number(page) + 1}`}>Next</Link></Button> : null}</div>
          </CardContent></Card>
          {selected ? <Card><CardHeader><CardTitle>{selected.fullName}</CardTitle></CardHeader><CardContent className="space-y-6">
            <AccountActions key={selected.id + selected.updatedAt} user={selected} assignments={assignments} />
            <div className="space-y-2"><h2 className="font-semibold">Active event assignments</h2>{selected.eventRoles.length === 0 ? <p className="text-sm text-muted-foreground">No active event roles.</p> : selected.eventRoles.map((assignment) => <Link key={assignment.eventId + assignment.roleCode} className="block rounded-lg border border-border p-3 text-sm" href={`/dashboard/events?eventId=${assignment.eventId}`}>{assignment.event.title} · {formatEnumLabel(assignment.roleCode)}</Link>)}</div>
          </CardContent></Card> : null}
        </div>
        <Card><CardHeader><CardTitle>Create account</CardTitle></CardHeader><CardContent><AccountCreateForm /></CardContent></Card>
      </div>
    );
  } catch {
    return <StatePanel icon={ShieldAlert} tone="error" title="Unable to load accounts" description="Check backend availability and reload this page." />;
  }
}
