import Link from "next/link";
import { AlertTriangle, ArrowRight, LogIn, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";

import { getPublicEvent } from "@/lib/api/public";
import { getCurrentUser, listMyRegistrations } from "@/lib/api/student";
import { ApiError } from "@/lib/api/shared";
import {
  formatEnumLabel,
  getEventStatusTone,
  getWindowStateTone,
  isRegistrationOpen,
} from "@/lib/format";
import { RegistrationForm } from "@/components/student/registration-form";
import { ParticipationSteps } from "@/components/student/participation-steps";
import { StudentAccessPanel } from "@/components/student/student-access-panel";
import { StudentSessionCard } from "@/components/student/student-session-card";
import { PublicPageShell } from "@/components/shell/public-page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatePanel } from "@/components/ui/state-panel";

export const dynamic = "force-dynamic";

export default async function EventRegistrationPage({
  params,
}: {
  params: Promise<{ eventLookup: string }>;
}) {
  const { eventLookup } = await params;

  try {
    const [event, user] = await Promise.all([
      getPublicEvent(eventLookup),
      getCurrentUser(),
    ]);

    const myRegistrations = user ? await listMyRegistrations(undefined, event.id) : [];
    const existingRegistration = myRegistrations.find(
      (registration) => registration.event.id === event.id,
    );

    return (
      <PublicPageShell>
        <main id="main-content" tabIndex={-1} className="section-shell py-12 sm:py-16">
          <ParticipationSteps current={!user ? 0 : existingRegistration ? 2 : 1} complete={existingRegistration?.paymentState === "VERIFIED"} />
          <PageHeader
            eyebrow="Student registration"
            title={`Register for ${event.title}`}
            description="Reserve your place, then add payment evidence if needed. Your participation details are visible only to you and authorized event personnel."
            action={
              <div className="flex flex-wrap gap-2">
                <Badge variant={getEventStatusTone(event.status)}>
                  {formatEnumLabel(event.status)}
                </Badge>
                <Badge variant={getWindowStateTone(event.registrationWindow.state)}>
                  Registration {formatEnumLabel(event.registrationWindow.state)}
                </Badge>
              </div>
            }
          />

          <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_380px]">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Before you register</CardTitle>
                <CardDescription>
                  Use your student account to register. You can follow payment review and event participation from your registration page.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-[1.15rem] border border-border/70 bg-panel-muted px-4 py-4 text-sm leading-6 text-muted-foreground">
                  Registration window: {formatEnumLabel(event.registrationWindow.state)}
                </div>
                <div className="rounded-[1.15rem] border border-border/70 bg-panel-muted px-4 py-4 text-sm leading-6 text-muted-foreground">
                  Public event detail: <Link className="font-medium text-primary" href={`/events/${event.slug}`}>return to event page</Link>
                </div>
              </CardContent>
            </Card>

            {user ? (
              <StudentSessionCard user={user} />
            ) : (
              <Card tone="muted">
                <CardHeader>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/10 bg-primary/5 text-primary">
                    <LogIn className="h-5 w-5" />
                  </div>
                  <CardTitle className="mt-4 text-xl">Student access is required</CardTitle>
                  <CardDescription>
                    Public event details are open, but registration creates private,
                    student-owned records and therefore requires authentication.
                  </CardDescription>
                </CardHeader>
              </Card>
            )}
          </div>

          <div className="mt-8">
            {!user ? (
              <StudentAccessPanel
                title="Sign in or create student access to continue"
                description="Create a student account or sign in with your Student ID to register for this event."
              />
            ) : existingRegistration ? (
              <StatePanel
                icon={ShieldCheck}
                tone="success"
                title="You already have a registration for this event"
                description="This student session already owns a registration record for the selected event."
                action={
                  <Button asChild size="sm">
                    <Link href={`/registrations/${existingRegistration.id}`}>
                      Open my registration
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                }
              />
            ) : !isRegistrationOpen(event) ? (
              <StatePanel
                icon={AlertTriangle}
                tone="warning"
                title="Registration is not open"
                description="This event is visible publicly, but the registration window is not currently open for new student entries."
              />
            ) : (
              <RegistrationForm event={event} accountStudentId={user.studentId ?? ""} />
            )}
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
        <main id="main-content" tabIndex={-1} className="section-shell py-12 sm:py-16">
          <PageHeader
            eyebrow="Student registration"
            title="Registration is temporarily unavailable"
            description="We could not load this event’s registration details. Please try again shortly."
          />
          <div className="mt-10">
            <StatePanel
              icon={AlertTriangle}
              tone="error"
              title="Student registration could not be prepared"
              description={
                error instanceof Error
                  ? error.message
                  : "An unexpected error prevented the registration flow from loading."
              }
            />
          </div>
        </main>
      </PublicPageShell>
    );
  }
}
