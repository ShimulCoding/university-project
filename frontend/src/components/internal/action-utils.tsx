"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { getApiErrorMessage } from "@/lib/api/shared";

type ActionState = {
  message: string | null;
  tone: "success" | "error" | null;
};

export function useActionState() {
  const [feedback, setFeedback] = useState<ActionState>({
    message: null,
    tone: null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRoutingPending, startTransition] = useTransition();
  const router = useRouter();
  const isPending = isSubmitting || isRoutingPending;

  const clearFeedback = () => setFeedback({ message: null, tone: null });

  const runAction = async (action: () => Promise<void>, successMessage: string) => {
    try {
      setIsSubmitting(true);
      clearFeedback();
      await action();
      setFeedback({ message: successMessage, tone: "success" });
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setFeedback({
        message: getApiErrorMessage(error, "The action could not be completed."),
        tone: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    feedback,
    isPending,
    clearFeedback,
    runAction,
  };
}

export function FeedbackMessage({
  feedback,
}: {
  feedback: ActionState;
}) {
  if (!feedback.message || !feedback.tone) {
    return null;
  }

  return (
    <div
      className={
        feedback.tone === "success"
          ? "rounded-[1rem] border border-success/15 bg-success-muted px-4 py-3 text-sm text-success"
          : "rounded-[1rem] border border-destructive/15 bg-destructive/5 px-4 py-3 text-sm text-destructive"
      }
    >
      {feedback.message}
    </div>
  );
}
