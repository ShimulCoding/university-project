import { ControlsShowcase } from "@/components/foundation/controls-showcase";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export default function DashboardControlsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Foundation controls"
        title="Reusable patterns for forms, queues, and system states"
        description="This page establishes the calm, premium control language that later events, payments, approvals, complaints, and reconciliation pages can reuse."
      />
      <Card tone="muted" className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="info">Forms</Badge>
          <Badge variant="success">Queues</Badge>
          <Badge variant="warning">State feedback</Badge>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground">
          These patterns are intentionally restrained. They prioritize confident review,
          accessible reading, and a clear distinction between internal action surfaces
          and public-safe outputs.
        </p>
      </Card>
      <ControlsShowcase />
    </>
  );
}
