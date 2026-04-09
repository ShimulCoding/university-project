import { AlertTriangle, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";

import { getCurrentUser, getRegistration } from "@/lib/api/student";
import { ApiError } from "@/lib/api/shared";
import { formatEnumLabel, getPaymentStateTone } from "@/lib/format";
import { PaymentProofForm } from "@/components/student/payment-proof-form";
import { StudentAccessPanel } from "@/components/student/student-access-panel";
import { StudentSessionCard } from "@/components/student/student-session-card";
import { PublicPageShell } from "@/components/shell/public-page-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatePanel } from "@/components/ui/state-panel";

export const dynamic = "force-dynamic";

export default async function PaymentProofPage({
  params,
}: {
  params: Promise<{ registrationId: string }>;
}) {
  const { registrationId } = await params;

  try {
    const user = await getCurrentUser();

    if (!user) {
      return (
        <PublicPageShell>
          <main className="section-shell py-12 sm:py-16">
            <PageHeader
              eyebrow="Payment proof"
              title="Sign in to submit payment proof"
              description="Payment proof is tied to a private registration record, so this page requires an authenticated student session."
            />
            <div className="mt-8">
              <StudentAccessPanel
                title="Open your private payment-proof flow"
                description="Sign in or create student access before submitting external payment proof for finance verification."
              />
            </div>
          </main>
        </PublicPageShell>
      );
    }

    const registration = await getRegistration(registrationId);
    const isBlocked =
      registration.paymentState === "VERIFIED" ||
      registration.paymentState === "PENDING_VERIFICATION";

    return (
      <PublicPageShell>
        <main className="section-shell py-12 sm:py-16">
          <PageHeader
            eyebrow="Payment proof"
            title={`Submit proof for ${registration.event.title}`}
            description="This is a student-owned private step. The proof enters finance review after submission and never appears on public pages."
            action={
              <Badge variant={getPaymentStateTone(registration.paymentState)}>
                {formatEnumLabel(registration.paymentState)}
              </Badge>
            }
          />

          <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_360px]">
            <div className="space-y-6">
              <Card tone="muted">
                <CardHeader>
                  <CardTitle className="text-xl">Registration context</CardTitle>
                  <CardDescription>
                    Registration code {registration.registrationCode} for {registration.participantName}.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="rounded-[1rem] border border-border/70 bg-panel px-4 py-4 text-sm leading-6 text-muted-foreground">
                    Use the same external payment details you actually submitted. The
                    backend will reject duplicate pending proofs and verified registrations.
                  </div>
                </CardContent>
              </Card>

              {isBlocked ? (
                <StatePanel
                  icon={registration.paymentState === "VERIFIED" ? ShieldCheck : AlertTriangle}
                  tone={registration.paymentState === "VERIFIED" ? "success" : "warning"}
                  title={
                    registration.paymentState === "VERIFIED"
                      ? "This registration is already verified"
                      : "A proof is already pending verification"
                  }
                  description={
                    registration.paymentState === "VERIFIED"
                      ? "No additional proof is needed for this registration."
                      : "Wait for the current proof to be reviewed before submitting another one."
                  }
                />
              ) : (
                <PaymentProofForm registrationId={registration.id} />
              )}
            </div>

            <StudentSessionCard user={user} />
          </div>
        </main>
      </PublicPageShell>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }

    return (
      <PublicPageShell>
        <main className="section-shell py-12 sm:py-16">
          <PageHeader
            eyebrow="Payment proof"
            title="Payment proof could not be prepared"
            description="The private registration context for this proof submission is not available right now."
          />
          <div className="mt-10">
            <StatePanel
              icon={AlertTriangle}
              tone="error"
              title="Payment proof submission is unavailable"
              description={
                error instanceof ApiError
                  ? error.message
                  : "An unexpected error prevented the payment-proof flow from loading."
              }
            />
          </div>
        </main>
      </PublicPageShell>
    );
  }
}
