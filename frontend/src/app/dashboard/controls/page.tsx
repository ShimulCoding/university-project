import { ControlsShowcase } from "@/components/foundation/controls-showcase";
import { PageHeader } from "@/components/ui/page-header";

export default function DashboardControlsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Foundation controls"
        title="Reusable patterns for forms, queues, and system states"
        description="This page establishes the calm, premium control language that later events, payments, approvals, complaints, and reconciliation pages can reuse."
      />
      <ControlsShowcase />
    </>
  );
}
