import { getCurrentUser } from "@/lib/api/student";
import { getInternalRoles, isSystemAdmin, isEventScopedOnlyUser } from "@/lib/access";
import { InternalAccessPanel } from "@/components/internal/internal-access-panel";
import { InternalSessionCard } from "@/components/internal/internal-session-card";
import { RolePreviewProvider } from "@/components/providers/role-preview-provider";
import { PublicPageShell } from "@/components/shell/public-page-shell";
import { DashboardShell } from "@/components/shell/dashboard-shell";
import { PageHeader } from "@/components/ui/page-header";
import { StatePanel } from "@/components/ui/state-panel";
import { ShieldAlert } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const internalRoles = getInternalRoles(user);

  if (!user) {
    return (
      <PublicPageShell>
        <main className="section-shell py-12 sm:py-16">
          <PageHeader
            eyebrow="System Administration"
            title="System Admin workspace requires authenticated credentials"
            description="This workspace is reserved for the system administrator. Sign in with your system admin account to manage events, roles, users, and platform configuration."
          />
          <div className="mt-8">
            <InternalAccessPanel />
          </div>
        </main>
      </PublicPageShell>
    );
  }

  // Event-scoped users (non-admin with event roles) get a lightweight wrapper.
  // They navigate to /dashboard/my-events and /dashboard/events/[slug]/* which
  // render their own shell — we just pass children through.
  if (isEventScopedOnlyUser(user)) {
    return <>{children}</>;
  }

  if (internalRoles.length === 0) {
    // User has no global internal roles and no event roles
    if ((user.eventRoles ?? []).length > 0) {
      // Has event roles but also has global roles — shouldn't happen here
      return <>{children}</>;
    }

    return (
      <PublicPageShell>
        <main className="section-shell py-12 sm:py-16">
          <PageHeader
            eyebrow="Protected workspace"
            title="This session is authenticated, but it does not have an internal role"
            description="The live backend recognized your account, but the internal finance and admin workspace is limited to operational roles only."
          />
          <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <StatePanel
              icon={ShieldAlert}
              tone="warning"
              title="No internal workspace access was granted"
              description="Use a seeded finance, approver, event management, complaint review, or system admin account to continue into the protected dashboard."
            />
            <InternalSessionCard user={user} />
          </div>
        </main>
      </PublicPageShell>
    );
  }

  return (
    <RolePreviewProvider initialRole={internalRoles[0]!} roles={internalRoles}>
      <DashboardShell user={user}>{children}</DashboardShell>
    </RolePreviewProvider>
  );
}
