import Link from "next/link";
import { AlertTriangle, ArrowRight, CreditCard, FileBadge2, ShieldCheck } from "lucide-react";

import { getCurrentUser, getRegistration, listMyRegistrations } from "@/lib/api/student";
import { ApiError } from "@/lib/api/shared";
import {
  formatDate,
  formatDateTime,
  formatEnumLabel,
  getPaymentStateTone,
} from "@/lib/format";
import { StudentAccessPanel } from "@/components/student/student-access-panel";
import { StudentSessionCard } from "@/components/student/student-session-card";
import { PublicPageShell } from "@/components/shell/public-page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatePanel } from "@/components/ui/state-panel";

export const dynamic = "force-dynamic";

export default async function RegistrationStatusPage({
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
              eyebrow="My registration"
              title="Sign in to view your registration status"
              description="Registration records are student-owned and private, so this page requires an authenticated session."
            />
            <div className="mt-8">
              <StudentAccessPanel
                title="Open your private registration view"
                description="Sign in or create student access to view registration status, payment state, and proof history."
              />
            </div>
          </main>
        </PublicPageShell>
      );
    }

    const [registration, myRegistrations] = await Promise.all([
      getRegistration(registrationId),
      listMyRegistrations(),
    ]);

    const canSubmitNewProof =
      registration.paymentState === "PAYMENT_PENDING" ||
      registration.paymentState === "REJECTED";

    return (
      <PublicPageShell>
        <main className="section-shell py-12 sm:py-16">
          <PageHeader
            eyebrow="My registration"
            title={`${registration.event.title} registration`}
            description="This page is private to your student session and shows the current registration and payment-proof state."
            action={
              <div className="flex flex-wrap gap-2">
                <Badge variant="neutral">{registration.registrationCode}</Badge>
                <Badge variant={getPaymentStateTone(registration.paymentState)}>
                  {formatEnumLabel(registration.paymentState)}
                </Badge>
              </div>
            }
          />

          <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_360px]">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl">Registration overview</CardTitle>
                  <CardDescription>
                    Participant details remain private to your account and authorized internal workflows.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-[1.15rem] border border-border/70 bg-panel-muted px-4 py-4">
                    <div className="data-kicker">Participant</div>
                    <div className="mt-2 text-sm font-semibold text-foreground">
                      {registration.participantName}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">{registration.email}</div>
                  </div>
                  <div className="rounded-[1.15rem] border border-border/70 bg-panel-muted px-4 py-4">
                    <div className="data-kicker">Student ID</div>
                    <div className="mt-2 text-sm font-semibold text-foreground">
                      {registration.studentId}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Phone {registration.phone ?? "Not provided"}
                    </div>
                  </div>
                  <div className="rounded-[1.15rem] border border-border/70 bg-panel-muted px-4 py-4">
                    <div className="data-kicker">Created</div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      {formatDateTime(registration.createdAt)}
                    </div>
                  </div>
                  <div className="rounded-[1.15rem] border border-border/70 bg-panel-muted px-4 py-4">
                    <div className="data-kicker">Event date</div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      {formatDate(registration.event.startsAt)}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="md:flex-row md:items-start md:justify-between">
                  <div>
                    <CardTitle className="text-2xl">Payment proof history</CardTitle>
                    <CardDescription>
                      Each proof stays private to your registration and the finance review process.
                    </CardDescription>
                  </div>
                  {canSubmitNewProof ? (
                    <Button asChild size="sm">
                      <Link href={`/registrations/${registration.id}/payment-proof`}>
                        Submit payment proof
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  ) : null}
                </CardHeader>
                <CardContent className="space-y-4">
                  {registration.paymentProofs.length === 0 ? (
                    <StatePanel
                      icon={CreditCard}
                      tone="empty"
                      title="No payment proof has been submitted yet"
                      description="You can add your first payment proof when you are ready. It will move into finance verification after submission."
                    />
                  ) : (
                    registration.paymentProofs.map((proof) => (
                      <div
                        key={proof.id}
                        className="rounded-[1.2rem] border border-border/70 bg-panel-muted p-5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap gap-2">
                            <Badge variant={getPaymentStateTone(proof.state)}>
                              {formatEnumLabel(proof.state)}
                            </Badge>
                            <Badge variant="neutral">{proof.externalChannel}</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Submitted {formatDateTime(proof.submittedAt)}
                          </div>
                        </div>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <div>
                            <div className="data-kicker">Reference</div>
                            <div className="mt-2 text-sm text-foreground">
                              {proof.transactionReference ?? "Not provided"}
                            </div>
                          </div>
                          <div>
                            <div className="data-kicker">Document coverage</div>
                            <div className="mt-2 text-sm text-foreground">
                              {proof.hasDocument
                                ? `${proof.documentCount ?? 0} supporting file(s)`
                                : "No file attached"}
                            </div>
                          </div>
                        </div>
                        {proof.referenceText ? (
                          <p className="mt-4 text-sm leading-6 text-muted-foreground">
                            {proof.referenceText}
                          </p>
                        ) : null}
                        {proof.reviewerRemark ? (
                          <div className="mt-4 rounded-[1rem] border border-border/70 bg-panel px-4 py-4 text-sm leading-6 text-muted-foreground">
                            <span className="font-medium text-foreground">Reviewer note:</span>{" "}
                            {proof.reviewerRemark}
                          </div>
                        ) : null}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <StudentSessionCard user={user} />

              {registration.paymentState === "PENDING_VERIFICATION" ? (
                <StatePanel
                  icon={FileBadge2}
                  tone="warning"
                  title="Your latest proof is under review"
                  description="Finance review is pending. A new proof cannot be submitted until the current pending proof is reviewed."
                />
              ) : null}

              {myRegistrations.length > 1 ? (
                <Card tone="muted">
                  <CardHeader>
                    <CardTitle className="text-xl">Other registrations in this session</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    {myRegistrations
                      .filter((item) => item.id !== registration.id)
                      .map((item) => (
                        <Link
                          key={item.id}
                          href={`/registrations/${item.id}`}
                          className="block rounded-[1.1rem] border border-border/70 bg-panel px-4 py-4 text-sm transition-colors hover:border-primary/15 hover:bg-background"
                        >
                          <div className="font-semibold text-foreground">{item.event.title}</div>
                          <div className="mt-1 text-muted-foreground">{item.registrationCode}</div>
                        </Link>
                      ))}
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </div>
        </main>
      </PublicPageShell>
    );
  } catch (error) {
    return (
      <PublicPageShell>
        <main className="section-shell py-12 sm:py-16">
          <PageHeader
            eyebrow="My registration"
            title="Registration status could not be loaded"
            description="This page depends on a private student session and a valid registration record."
          />
          <div className="mt-10">
            <StatePanel
              icon={AlertTriangle}
              tone="error"
              title="The requested registration could not be opened"
              description={
                error instanceof ApiError
                  ? error.message
                  : "An unexpected error prevented the registration from loading."
              }
            />
          </div>
        </main>
      </PublicPageShell>
    );
  }
}
