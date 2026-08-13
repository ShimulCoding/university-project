"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

export function EventTeamRouteBoundary({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isEventWorkspaceRoute =
    pathname === "/dashboard/my-events" || pathname.startsWith("/dashboard/events/");

  useEffect(() => {
    if (!isEventWorkspaceRoute) {
      router.replace("/dashboard/my-events");
    }
  }, [isEventWorkspaceRoute, router]);

  if (!isEventWorkspaceRoute) {
    return (
      <main className="section-shell flex min-h-[70vh] items-center justify-center py-16">
        <div className="surface-panel max-w-xl p-8 text-center">
          <div className="data-kicker">Event-scoped session</div>
          <h1 className="mt-4 text-2xl font-semibold text-foreground">
            Opening your assigned event workspace
          </h1>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            Global administration is reserved for the System Admin. Event team work stays inside
            the event you select from My Events.
          </p>
        </div>
      </main>
    );
  }

  return children;
}
