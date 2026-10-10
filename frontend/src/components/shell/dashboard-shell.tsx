"use client";

import type { UserProfile } from "@/types";

import { DashboardHeader } from "@/components/shell/dashboard-header";
import { DashboardSidebar } from "@/components/shell/dashboard-sidebar";

export function DashboardShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: UserProfile;
}) {
  return (
    <div className="workspace-frame">
      <DashboardSidebar user={user} />
      <div className="workspace-content">
        <DashboardHeader user={user} />
        <main id="main-content" tabIndex={-1} className="space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
}
