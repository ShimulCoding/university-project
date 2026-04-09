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
    <div className="section-shell py-6 lg:py-8">
      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
        <DashboardSidebar user={user} />
        <div className="order-1 min-w-0 space-y-6 lg:order-none">
          <DashboardHeader user={user} />
          <main className="space-y-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
