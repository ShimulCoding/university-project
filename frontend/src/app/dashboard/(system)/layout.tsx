import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/api/student";
import { isEventScopedOnlyUser, isSystemAdmin } from "@/lib/access";
import { InternalAccessPanel } from "@/components/internal/internal-access-panel";
import { RolePreviewProvider } from "@/components/providers/role-preview-provider";
import { DashboardShell } from "@/components/shell/dashboard-shell";
import { PublicPageShell } from "@/components/shell/public-page-shell";
import { AccessLayout } from "@/components/shell/access-layout";

export default async function SystemDashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (isEventScopedOnlyUser(user)) redirect("/dashboard/my-events");

  if (!isSystemAdmin(user) || !user) {
    return (
      <PublicPageShell>
        <AccessLayout kind="system" title="System Admin sign in" description="Bring your events to life. Build their teams, manage platform access, and keep every handoff clear."><InternalAccessPanel /></AccessLayout>
      </PublicPageShell>
    );
  }

  return (
    <RolePreviewProvider initialRole="SYSTEM_ADMIN" roles={["SYSTEM_ADMIN"]}>
      <DashboardShell user={user}>{children}</DashboardShell>
    </RolePreviewProvider>
  );
}
