import { Skeleton } from "@/components/ui/skeleton";

export default function EventsLoading() {
  return (
    <main className="section-shell py-12 sm:py-16">
      <div className="surface-panel p-8">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="mt-4 h-10 w-96 max-w-full" />
        <Skeleton className="mt-4 h-4 w-full max-w-3xl" />
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="surface-panel p-6">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-5 h-8 w-20" />
            <Skeleton className="mt-4 h-4 w-full" />
          </div>
        ))}
      </div>
      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="surface-panel p-6">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="mt-5 h-5 w-3/4" />
            <Skeleton className="mt-4 h-32 w-full" />
          </div>
        ))}
      </div>
    </main>
  );
}
