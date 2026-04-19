import type { PaginationInput } from "../../../utils/pagination";

export type CreateRegistrationInput = {
  eventId: string;
  studentId: string;
  phone?: string | undefined;
};

export type RegistrationListFilters = PaginationInput;
