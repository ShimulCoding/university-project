import { RolePreviewProvider } from "@/components/providers/role-preview-provider";
import { DashboardShell } from "@/components/shell/dashboard-shell";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RolePreviewProvider>
      <DashboardShell>{children}</DashboardShell>
    </RolePreviewProvider>
  );
}
