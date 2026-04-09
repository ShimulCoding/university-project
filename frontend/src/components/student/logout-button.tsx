"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { apiFetchClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleLogout = async () => {
    try {
      setErrorMessage(null);
      await apiFetchClient("/auth/logout", {
        method: "POST",
      });
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Logout failed.");
    }
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <Button type="button" variant="outline" size="sm" onClick={handleLogout} disabled={isPending}>
        {isPending ? "Signing out..." : "Sign out"}
      </Button>
      {errorMessage ? <div className="text-xs text-destructive">{errorMessage}</div> : null}
    </div>
  );
}
