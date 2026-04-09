import type { UserProfile } from "@/types";

import { formatEnumLabel } from "@/lib/format";
import { LogoutButton } from "@/components/student/logout-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function StudentSessionCard({
  user,
  title = "Signed in for student-owned actions",
  description = "Your registration, payment proof, and complaint actions are handled in a private session that is separate from public-safe pages.",
}: {
  user: UserProfile;
  title?: string;
  description?: string;
}) {
  return (
    <Card tone="muted">
      <CardHeader className="md:flex-row md:items-start md:justify-between">
        <div>
          <Badge variant="success">Private student session</Badge>
          <CardTitle className="mt-4 text-xl">{title}</CardTitle>
          <CardDescription className="mt-3 max-w-2xl">{description}</CardDescription>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="neutral">{user.fullName}</Badge>
            <Badge variant="info">{user.email}</Badge>
            {user.roles.map((role) => (
              <Badge key={role} variant="neutral">
                {formatEnumLabel(role)}
              </Badge>
            ))}
          </div>
        </div>
        <LogoutButton />
      </CardHeader>
    </Card>
  );
}
