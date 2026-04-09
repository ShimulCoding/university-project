import type { ComplaintRoutingSummary } from "@/types";
import { formatDateTime, formatEnumLabel } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ComplaintRoutingCard({
  routingHistory,
}: {
  routingHistory: ComplaintRoutingSummary[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Routing history</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {routingHistory.length === 0 ? (
          <div className="rounded-[1rem] border border-border/70 bg-panel-muted px-4 py-4 text-sm leading-6 text-muted-foreground">
            No routing activity has been recorded for this complaint yet.
          </div>
        ) : (
          routingHistory.map((routing) => (
            <div
              key={routing.id}
              className="rounded-[1rem] border border-border/70 bg-panel-muted px-4 py-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="info">{formatEnumLabel(routing.state)}</Badge>
                <div className="text-sm text-muted-foreground">
                  {formatDateTime(routing.createdAt)}
                </div>
              </div>
              <div className="mt-3 text-sm leading-6 text-muted-foreground">
                {routing.fromRole ? `From ${routing.fromRole.name}` : "Initial routing"}
                {routing.toRole ? ` to ${routing.toRole.name}` : ""}
                {routing.routedBy ? ` by ${routing.routedBy.fullName}` : ""}
              </div>
              {routing.note ? (
                <div className="mt-3 text-sm leading-6 text-muted-foreground">{routing.note}</div>
              ) : null}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
