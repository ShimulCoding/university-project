"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { ApiError } from "@/lib/api/shared";
import { postFormData } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function PaymentProofForm({ registrationId }: { registrationId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = async (submitEvent: React.FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();

    const formData = new FormData(submitEvent.currentTarget);

    try {
      setErrorMessage(null);
      await postFormData(`/payments/registrations/${registrationId}/proofs`, formData);

      formRef.current?.reset();
      startTransition(() => {
        router.push(`/registrations/${registrationId}`);
        router.refresh();
      });
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError ? error.message : "Unable to submit the payment proof.",
      );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Submit payment proof</CardTitle>
        <CardDescription>
          No live payment gateway is used here. Submit the external payment channel,
          reference, and optional proof file for finance review.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={formRef} className="grid gap-5" onSubmit={handleSubmit}>
          <Field
            label="External payment channel"
            description="For example bKash, Nagad, Rocket, bank transfer, or other approved channel."
          >
            <Input name="externalChannel" placeholder="e.g. bKash" required />
          </Field>
          <Field
            label="Transaction reference"
            description="Optional but recommended if your external channel provides one."
          >
            <Input name="transactionReference" placeholder="Enter external reference" />
          </Field>
          <Field
            label="Amount"
            description="Enter the amount exactly as transferred."
          >
            <Input name="amount" inputMode="decimal" placeholder="e.g. 500.00" />
          </Field>
          <Field
            label="Reference note"
            description="Use this for any additional payment context the finance reviewer should see."
          >
            <Textarea
              name="referenceText"
              rows={4}
              placeholder="Add optional context about your transfer or proof."
            />
          </Field>
          <Field
            label="Proof file"
            description="Images and PDFs are accepted where allowed by the backend upload policy."
          >
            <Input name="proofFile" type="file" />
          </Field>
          {errorMessage ? (
            <div className="rounded-[1rem] border border-destructive/15 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {errorMessage}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Submitting proof..." : "Submit for verification"}
            </Button>
            <span className="text-sm text-muted-foreground">
              After submission, the registration moves into finance verification review.
            </span>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
