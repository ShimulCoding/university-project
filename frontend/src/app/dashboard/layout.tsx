import { getCurrentUser } from "@/lib/api/student";
import { getInternalRoles } from "@/lib/access";
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
            eyebrow="Protected workspace"
            title="Internal finance and governance routes require an authenticated internal role"
            description="This workspace connects directly to the live backend. Sign in with one of the seeded internal demo accounts to review finance, approvals, complaints, reconciliation, publication, and audit flows."
          />
          <div className="mt-8">
            <InternalAccessPanel />
          </div>
        </main>
      </PublicPageShell>
    );
  }

  if (internalRoles.length === 0) {
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
