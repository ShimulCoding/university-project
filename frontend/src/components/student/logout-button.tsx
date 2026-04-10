"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { apiFetchClient } from "@/lib/api/client";
import { Button, type ButtonProps } from "@/components/ui/button";

type LogoutButtonProps = {
  redirectTo?: string;
  buttonLabel?: string;
} & Pick<ButtonProps, "size" | "variant" | "className">;

export function LogoutButton({
  redirectTo,
  buttonLabel = "Sign out",
  variant = "outline",
  size = "sm",
  className,
}: LogoutButtonProps) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, startTransition] = useTransition();
  const isBusy = isSubmitting;

  const handleLogout = async () => {
    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await apiFetchClient("/auth/logout", {
        method: "POST",
      });
      setIsSubmitting(false);
      startTransition(() => {
        if (redirectTo) {
          router.replace(redirectTo);
        }
        router.refresh();
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Logout failed.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={handleLogout}
        disabled={isBusy}
      >
        {isBusy ? "Signing out..." : buttonLabel}
      </Button>
      {errorMessage ? <div className="text-xs text-destructive">{errorMessage}</div> : null}
    </div>
  );
}
