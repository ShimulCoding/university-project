import { PublicFooter } from "@/components/shell/public-footer";
import { PublicHeader } from "@/components/shell/public-header";

export function PublicPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-tint min-h-screen">
      <PublicHeader />
      <div className="public-content relative">{children}</div>
      <PublicFooter />
    </div>
  );
}
