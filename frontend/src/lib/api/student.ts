import { apiList } from "@/lib/api/list";
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

export async function listMyRegistrations(page?: string, eventId?: string) {
  return apiList<RegistrationRecord>("/registrations/me", "registrations", { page, eventId });
}

export async function listMyComplaints(page?: string) {
  return apiList<ComplaintRecord>("/complaints/mine", "complaints", { page });
}
