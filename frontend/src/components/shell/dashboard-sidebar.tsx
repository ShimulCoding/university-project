"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { dashboardNavigation, dashboardSupportLinks, roleMeta } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { useRolePreview } from "@/components/providers/role-preview-provider";
import { AppLogo } from "@/components/shell/app-logo";
import { Badge } from "@/components/ui/badge";

export function DashboardSidebar() {
  const pathname = usePathname();
  const { activeRole } = useRolePreview();

  const activeRoleMeta = roleMeta[activeRole];
  const navigation = dashboardNavigation.filter((item) => item.roles.includes(activeRole));

  return (
    <aside className="order-2 surface-panel-muted flex h-full flex-col gap-8 p-5 lg:order-none lg:sticky lg:top-6 lg:min-h-[calc(100vh-3rem)]">
      <div className="space-y-5">
        <AppLogo />
        <div className="rounded-[1.35rem] border border-primary/10 bg-primary px-4 py-4 text-primary-foreground shadow-panel">
          <div className="flex items-center justify-between gap-3">
            <div className="data-kicker text-primary-foreground/70">Role preview</div>
            <Badge className="border-white/10 bg-white/10 text-white" variant="neutral">
              {activeRoleMeta.shortLabel}
            </Badge>
          </div>
          <div className="mt-3 text-base font-semibold">{activeRoleMeta.label}</div>
          <p className="mt-2 text-sm leading-6 text-primary-foreground/80">
            {activeRoleMeta.description}
          </p>
        </div>
      </div>

      <div>
        <div className="data-kicker">Workspace</div>
        <nav className="mt-4 space-y-2">
          {navigation.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "focus-ring flex items-start gap-3 rounded-[1.15rem] border px-4 py-3 transition-colors",
                  active
                    ? "border-primary/15 bg-panel text-foreground shadow-panel"
                    : "border-transparent bg-transparent text-muted-foreground hover:border-border/70 hover:bg-panel hover:text-foreground",
                )}
              >
                <div className="mt-0.5 rounded-xl border border-border/70 bg-panel p-2 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold">{item.label}</div>
                  <div className="mt-1 text-xs leading-5 text-muted-foreground">
                    {item.description}
                  </div>
                </div>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="space-y-3">
        <div className="data-kicker">Platform posture</div>
        {dashboardSupportLinks.map((item) => {
          const Icon = item.icon;

          return (
            <div
              key={item.title}
              className="rounded-[1.15rem] border border-border/70 bg-panel px-4 py-3 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-xl border border-border/70 bg-panel-muted p-2 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">{item.title}</div>
                  <div className="mt-1 text-xs leading-5 text-muted-foreground">
                    {item.description}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
