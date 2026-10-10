"use client";
import type { UserProfile } from "@/types";
import { dashboardNavigation } from "@/lib/navigation";
import { useRolePreview } from "@/components/providers/role-preview-provider";
import { WorkspaceSidebar } from "@/components/shell/workspace-sidebar";

export function DashboardSidebar({ user }: { user: UserProfile }) {
  const { activeRole } = useRolePreview();
  return (
    <WorkspaceSidebar
      user={user}
      label="System Admin"
      title="Platform administration"
      subtitle="Events, people, and governance"
      links={dashboardNavigation.filter((item) =>
        item.roles.includes(activeRole),
      )}
      publicHref="/"
    />
  );
}
