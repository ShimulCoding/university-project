import type { ComplaintRecord, RegistrationRecord, UserProfile } from "@/types";

import { ApiError } from "@/lib/api/shared";
import { apiFetchServer } from "@/lib/api/server";

export async function getCurrentUser() {
  try {
    const response = await apiFetchServer<{ user: UserProfile }>("/auth/me");
    return response.user;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }

    throw error;
  }
}

export async function getRegistration(registrationId: string) {
  const response = await apiFetchServer<{ registration: RegistrationRecord }>(
    `/registrations/${registrationId}`,
  );

  return response.registration;
}

export async function listMyRegistrations() {
  const response = await apiFetchServer<{ registrations: RegistrationRecord[] }>(
    "/registrations/me",
  );

  return response.registrations;
}

export async function listMyComplaints() {
  const response = await apiFetchServer<{ complaints: ComplaintRecord[] }>("/complaints/mine");
  return response.complaints;
}
