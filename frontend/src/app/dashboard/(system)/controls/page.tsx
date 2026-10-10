import { ControlsShowcase } from "@/components/foundation/controls-showcase";
import { PageHeader } from "@/components/ui/page-header";

export default function DashboardControlsPage() {
  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        eyebrow="System interface"
        title="Controls & patterns"
        description="Preview the shared forms, tables, and feedback messages used throughout the platform. These are examples and do not update event records."
      />
      <ControlsShowcase />
    </div>
  );
}
