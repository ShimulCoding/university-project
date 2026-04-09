"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { getApiErrorMessage } from "@/lib/api/shared";
import { postFormData } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type PaymentProofFieldErrors = Partial<
  Record<"externalChannel" | "transactionReference" | "amount" | "referenceText" | "proofFile", string>
>;

export function PaymentProofForm({ registrationId }: { registrationId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [fieldErrors, setFieldErrors] = useState<PaymentProofFieldErrors>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const clearFieldError = (field: keyof PaymentProofFieldErrors) => {
    setErrorMessage(null);
    setFieldErrors((current) => ({
      ...current,
      [field]: undefined,
    }));
  };

  const handleSubmit = async (submitEvent: React.FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();

    const formData = new FormData(submitEvent.currentTarget);
    const externalChannel = formData.get("externalChannel")?.toString().trim() ?? "";
    const transactionReference = formData.get("transactionReference")?.toString().trim() ?? "";
    const referenceText = formData.get("referenceText")?.toString().trim() ?? "";
    const amount = formData.get("amount")?.toString().trim() ?? "";
    const proofFile = formData.get("proofFile");
    const hasProofFile = proofFile instanceof File && proofFile.size > 0;
    const nextFieldErrors: PaymentProofFieldErrors = {};

    if (externalChannel.length < 2) {
      nextFieldErrors.externalChannel = "Use at least 2 characters for the payment channel.";
    }

    if (amount && !/^\d+(\.\d{1,2})?$/.test(amount)) {
      nextFieldErrors.amount = "Amount must be a valid monetary value.";
    }

    if (!transactionReference && !referenceText && !hasProofFile) {
      nextFieldErrors.transactionReference = "Add a reference, note, or proof file.";
      nextFieldErrors.referenceText = "Add a reference, note, or proof file.";
      nextFieldErrors.proofFile = "Add a reference, note, or proof file.";
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setErrorMessage("Please complete the payment proof details before submitting.");
      return;
    }

    try {
      setErrorMessage(null);
      setFieldErrors({});
      formData.set("externalChannel", externalChannel);

      if (transactionReference) {
        formData.set("transactionReference", transactionReference);
      } else {
        formData.delete("transactionReference");
      }

      if (referenceText) {
        formData.set("referenceText", referenceText);
      } else {
        formData.delete("referenceText");
      }

      if (amount) {
        formData.set("amount", amount);
      } else {
        formData.delete("amount");
      }

      await postFormData(`/payments/registrations/${registrationId}/proofs`, formData);

      formRef.current?.reset();
      startTransition(() => {
        router.push(`/registrations/${registrationId}`);
        router.refresh();
      });
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, "Unable to submit the payment proof."));
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
            error={fieldErrors.externalChannel}
          >
            <Input
              name="externalChannel"
              placeholder="e.g. bKash"
              minLength={2}
              maxLength={80}
              onChange={() => clearFieldError("externalChannel")}
              aria-invalid={Boolean(fieldErrors.externalChannel)}
              required
            />
          </Field>
          <Field
            label="Transaction reference"
            description="Optional but recommended if your external channel provides one."
            error={fieldErrors.transactionReference}
          >
            <Input
              name="transactionReference"
              placeholder="Enter external reference"
              maxLength={120}
              onChange={() => clearFieldError("transactionReference")}
              aria-invalid={Boolean(fieldErrors.transactionReference)}
            />
          </Field>
          <Field
            label="Amount"
            description="Enter the amount exactly as transferred."
            error={fieldErrors.amount}
          >
            <Input
              name="amount"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="e.g. 500.00"
              onChange={() => clearFieldError("amount")}
              aria-invalid={Boolean(fieldErrors.amount)}
            />
          </Field>
          <Field
            label="Reference note"
            description="Use this for any additional payment context the finance reviewer should see."
            error={fieldErrors.referenceText}
          >
            <Textarea
              name="referenceText"
              rows={4}
              placeholder="Add optional context about your transfer or proof."
              maxLength={2000}
              onChange={() => clearFieldError("referenceText")}
              aria-invalid={Boolean(fieldErrors.referenceText)}
            />
          </Field>
          <Field
            label="Proof file"
            description="Images and PDFs are accepted where allowed by the backend upload policy."
            error={fieldErrors.proofFile}
          >
            <Input
              name="proofFile"
              type="file"
              accept="image/*,.pdf"
              onChange={() => clearFieldError("proofFile")}
              aria-invalid={Boolean(fieldErrors.proofFile)}
            />
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
