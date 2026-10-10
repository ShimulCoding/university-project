import type { UserProfile } from "@/types";
import { LockKeyhole, UserRound } from "lucide-react";
import { LogoutButton } from "@/components/student/logout-button";
import { Card } from "@/components/ui/card";

export function StudentSessionCard({
  user,
  title = "Your student account",
  description = "Your participation, payment evidence, and complaints stay private.",
}: {
  user: UserProfile;
  title?: string;
  description?: string;
}) {
  return (
    <Card tone="muted">
      <div className="flex items-center gap-2 text-xs font-medium text-success">
        <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
        Private student session
      </div>
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      <div className="mt-5 flex min-w-0 items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-panel text-success">
          <UserRound className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className="break-words text-sm font-semibold">
            {user.fullName}
          </div>
          <div className="mt-1 break-all text-xs leading-5 text-muted-foreground">
            {user.email}
          </div>
          {user.studentId ? (
            <div className="mt-1 text-xs text-muted-foreground">
              ID: {user.studentId}
            </div>
          ) : null}
        </div>
      </div>
      <p className="mt-5 text-xs leading-6 text-muted-foreground">
        {description}
      </p>
      <div className="mt-5 border-t border-border pt-4">
        <LogoutButton />
      </div>
    </Card>
  );
}
