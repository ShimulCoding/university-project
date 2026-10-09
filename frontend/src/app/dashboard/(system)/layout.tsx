import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/api/student";
import { isEventScopedOnlyUser, isSystemAdmin } from "@/lib/access";
import { InternalAccessPanel } from "@/components/internal/internal-access-panel";
import { RolePreviewProvider } from "@/components/providers/role-preview-provider";
import { DashboardShell } from "@/components/shell/dashboard-shell";
import { PublicPageShell } from "@/components/shell/public-page-shell";
import { PageHeader } from "@/components/ui/page-header";

export default async function SystemDashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (isEventScopedOnlyUser(user)) redirect("/dashboard/my-events");

  if (!isSystemAdmin(user) || !user) {
    return (
      <PublicPageShell>
        <main className="section-shell py-12 sm:py-16">
          <PageHeader eyebrow="System Administration" title="System Admin sign in"
            description="Create and publish events, assign their teams, manage accounts, and review the platform audit trail." />
          <div className="mt-8"><InternalAccessPanel /></div>
        </main>
      </PublicPageShell>
    );
  }

  return (
    <RolePreviewProvider initialRole="SYSTEM_ADMIN" roles={["SYSTEM_ADMIN"]}>
      <DashboardShell user={user}>{children}</DashboardShell>
    </RolePreviewProvider>
  );
}
