import type { UserProfile } from "@/types";

import { formatEnumLabel } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function InternalSessionCard({
  user,
  title = "Active internal session",
  description = "This workspace uses the live backend session and only exposes workflows allowed for the authenticated internal roles.",
}: {
  user: UserProfile;
  title?: string;
  description?: string;
}) {
  return (
    <Card tone="muted">
      <CardHeader>
        <Badge variant="info" className="w-fit">
          Protected internal session
        </Badge>
        <CardTitle className="mt-4 text-xl">{title}</CardTitle>
        <CardDescription className="mt-3">{description}</CardDescription>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="neutral">{user.fullName}</Badge>
          <Badge variant="info">{user.email}</Badge>
          {user.roles.map((role) => (
            <Badge key={role} variant="neutral">
              {formatEnumLabel(role)}
            </Badge>
          ))}
        </div>
      </CardHeader>
    </Card>
  );
}
