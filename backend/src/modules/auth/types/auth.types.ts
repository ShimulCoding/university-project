import type { UserProfile } from "../../users/users.mappers";

export type RegisterInput = {
  fullName: string;
  email: string;
  password: string;
  studentId: string;
  batch: string;
  department: string;
  section: string;
};

export type LoginInput = {
  studentId: string;
  password: string;
};

export type ForgotPasswordInput = {
  studentId: string;
  email: string;
};

export type ResetPasswordInput = {
  token: string;
  newPassword: string;
};

export type AuthSessionResult = {
  user: UserProfile;
  accessToken: string;
  refreshToken: string;
};

