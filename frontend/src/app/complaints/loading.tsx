import { Skeleton } from "@/components/ui/skeleton";

export default function ComplaintsLoading() {
  return (
    <main className="section-shell py-12 sm:py-16">
      <div className="surface-panel p-8">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="mt-4 h-10 w-[28rem] max-w-full" />
        <Skeleton className="mt-4 h-4 w-full max-w-3xl" />
      </div>
      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_360px]">
        <div className="surface-panel p-6">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-6 h-64 w-full" />
        </div>
        <div className="surface-panel p-6">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mt-6 h-40 w-full" />
        </div>
      </div>
    </main>
  );
}
