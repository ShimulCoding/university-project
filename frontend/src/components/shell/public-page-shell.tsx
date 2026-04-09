import { PublicFooter } from "@/components/shell/public-footer";
import { PublicHeader } from "@/components/shell/public-header";

export function PublicPageShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="page-tint min-h-screen">
      <div className="page-grid pointer-events-none fixed inset-0 z-0 opacity-[0.18] [mask-image:radial-gradient(circle_at_center,black,transparent_78%)]" />
      <PublicHeader />
      <div className="relative z-10">{children}</div>
      <PublicFooter />
    </div>
  );
}
