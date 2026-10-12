import { AccountStatus, RoleCode } from "@prisma/client";

import type { AuthenticatedUser } from "../src/types/auth";
import { AppError } from "../src/utils/app-error";
import {
  assertGlobalAccountRole,
  assertEventScopedOperationalAccess,
  assertSystemAdminOrEventRole,
  getAssignedEventIds,
  hasEventScopedRole,
  scopeEventFilters,
  type EventFilterScope,
} from "../src/utils/event-scope";

const eventA = "event-a";
const eventB = "event-b";

function user(input: Pick<AuthenticatedUser, "roles" | "eventRoles">): AuthenticatedUser {
  return {
    id: "verification-user",
    fullName: "Event Scope Verification",
    email: "event.scope@example.com",
    status: AccountStatus.ACTIVE,
    ...input,
  };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function expectForbidden(action: () => unknown, message: string) {
  try {
    action();
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 403) {
      return;
    }

    throw error;
  }

  throw new Error(message);
}

function expectInvalidGlobalRole(action: () => unknown, message: string) {
  try {
    action();
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 400) {
      return;
    }

    throw error;
  }

  throw new Error(message);
}

const eventFinance = user({
  roles: [],
  eventRoles: [{ eventId: eventA, roleCode: RoleCode.FINANCIAL_CONTROLLER }],
});
const systemAdmin = user({
  roles: [RoleCode.SYSTEM_ADMIN],
  eventRoles: [],
});

assert(
  hasEventScopedRole(eventFinance, eventA, [RoleCode.FINANCIAL_CONTROLLER]),
  "Assigned event finance role was not recognized.",
);
assert(
  !hasEventScopedRole(eventFinance, eventB, [RoleCode.FINANCIAL_CONTROLLER]),
  "An assignment leaked into another event.",
);
assert(
  getAssignedEventIds(eventFinance, [RoleCode.FINANCIAL_CONTROLLER])?.join(",") === eventA,
  "Assigned event filtering returned an unexpected event set.",
);

const scopedFilters = scopeEventFilters<EventFilterScope>(eventFinance, {}, [RoleCode.FINANCIAL_CONTROLLER]);
assert(scopedFilters.eventIds?.join(",") === eventA, "List filters were not event-scoped.");

expectForbidden(
  () => scopeEventFilters(eventFinance, { eventId: eventB }, [RoleCode.FINANCIAL_CONTROLLER]),
  "A user could explicitly request an unassigned event.",
);
expectForbidden(
  () =>
    assertEventScopedOperationalAccess(systemAdmin, eventA, [
      RoleCode.FINANCIAL_CONTROLLER,
    ]),
  "System Admin bypassed the event operational separation boundary.",
);

assertSystemAdminOrEventRole(systemAdmin, eventB, [RoleCode.FINANCIAL_CONTROLLER]);

assertGlobalAccountRole(RoleCode.SYSTEM_ADMIN);
assertGlobalAccountRole(RoleCode.GENERAL_STUDENT);
expectInvalidGlobalRole(
  () => assertGlobalAccountRole(RoleCode.FINANCIAL_CONTROLLER),
  "An event operational role could still be assigned globally.",
);

console.log(
  "Event-scope verification passed: assignment isolation, admin separation, and global-role boundaries are intact.",
);
