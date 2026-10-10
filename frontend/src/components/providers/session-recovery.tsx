"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { recoverClientSession } from "@/lib/api/client";

export function SessionRecovery({ needed, children }: { needed: boolean; children: React.ReactNode }) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!needed) return;
    let active = true;
    recoverClientSession().then((recovered) => {
      if (!active) return;
      if (recovered) startTransition(() => router.refresh());
      else setFailed(true);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [needed, router]);

  if (needed && !failed) {
    return <main className="flex min-h-screen items-center justify-center" role="status">Restoring your session…</main>;
  }
  return children;
}
