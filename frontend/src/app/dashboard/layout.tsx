export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Each child workspace owns its sign-in and authorization boundary.
  return children;
}
