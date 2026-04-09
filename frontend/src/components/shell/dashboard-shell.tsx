"use client";

import { DashboardHeader } from "@/components/shell/dashboard-header";
import { DashboardSidebar } from "@/components/shell/dashboard-sidebar";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="section-shell py-6 lg:py-8">
      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <DashboardSidebar />
        <div className="space-y-6">
          <DashboardHeader />
          <main className="space-y-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
