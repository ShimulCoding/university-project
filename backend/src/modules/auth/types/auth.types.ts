import type { UserProfile } from "../../users/users.mappers";

export type RegisterInput = {
  fullName: string;
  email: string;
  password: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type AuthSessionResult = {
  user: UserProfile;
  accessToken: string;
  refreshToken: string;
};

