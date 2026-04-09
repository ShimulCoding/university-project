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

    const myRegistrations = user ? await listMyRegistrations() : [];
    const existingRegistration = myRegistrations.find(
      (registration) => registration.event.id === event.id,
    );

    return (
      <PublicPageShell>
        <main className="section-shell py-12 sm:py-16">
          <PageHeader
            eyebrow="Student registration"
            title={`Register for ${event.title}`}
            description="This creates a private participant record for the selected event. Public event pages remain separate from your student-owned registration data."
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
                  Student registration is private and session-bound. After registration,
                  payment proof submission and status tracking stay in your student-owned area.
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
                description="Authentication is required before the platform can create your participant record and attach future payment proof actions to your account."
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
              <RegistrationForm event={event} />
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
        <main className="section-shell py-12 sm:py-16">
          <PageHeader
            eyebrow="Student registration"
            title="Registration is temporarily unavailable"
            description="The live backend could not load the selected event or registration context right now."
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
