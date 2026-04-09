import type { ApprovalDecisionRecord } from "@/types";
import { formatDateTime, formatEnumLabel } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const decisionToneMap = {
  APPROVED: "success",
  REJECTED: "danger",
  RETURNED: "warning",
} as const;

export function DecisionHistoryCard({
  decisions,
}: {
  decisions: ApprovalDecisionRecord[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Decision history</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {decisions.length === 0 ? (
          <div className="rounded-[1rem] border border-border/70 bg-panel-muted px-4 py-4 text-sm leading-6 text-muted-foreground">
            No approval decisions are attached to this record yet.
          </div>
        ) : (
          decisions.map((decision) => (
            <div
              key={decision.id}
              className="rounded-[1rem] border border-border/70 bg-panel-muted px-4 py-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={decisionToneMap[decision.decision]}>
                  {formatEnumLabel(decision.decision)}
                </Badge>
                <div className="text-sm text-muted-foreground">
                  {decision.actor.fullName} on {formatDateTime(decision.createdAt)}
                </div>
              </div>
              {decision.comment ? (
                <div className="mt-3 text-sm leading-6 text-muted-foreground">{decision.comment}</div>
              ) : null}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
