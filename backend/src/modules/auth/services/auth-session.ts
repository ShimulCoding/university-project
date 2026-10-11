import { env } from "../../../config/env";
import { prisma } from "../../../config/prisma";
import type { DbClient } from "../../../types/database";
import { AppError } from "../../../utils/app-error";
import { durationToMs } from "../../../utils/duration";
import { hashValue } from "../../../utils/hash";
import { signAccessToken, signRefreshToken } from "../../../utils/tokens";
import { mapUserProfile, type UserWithActiveRoles } from "../../users/users.mappers";
import { usersRepository } from "../../users/repositories/users.repository";
import type { AuditMetadata } from "../../audit/types/audit.types";
import { authRepository } from "../repositories/auth.repository";
import type { AuthSessionResult } from "../types/auth.types";

export const MFA_ASSURANCE_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export function requiresPrivilegedMfa(user: UserWithActiveRoles) {
  const profile = mapUserProfile(user);
  // Role removal must not silently disable an already enrolled account's MFA.
  return !!user.mfaFactor || profile.roles.includes("SYSTEM_ADMIN") || profile.eventRoles.length > 0;
}

export function hasCurrentMfaAssurance(verifiedAt: Date | null | undefined) {
  return !!verifiedAt && verifiedAt <= new Date() && Date.now() - verifiedAt.getTime() < MFA_ASSURANCE_MAX_AGE_MS;
}

export async function issueSession(userId: string, metadata?: AuditMetadata, db: DbClient = prisma, mfaVerifiedAt?: Date | null): Promise<Pick<AuthSessionResult, "accessToken" | "refreshToken">> {
  const user = await usersRepository.findById(userId, db);
  if (!user || user.status !== "ACTIVE") throw new AppError(401, "This account is not active.");
  if (requiresPrivilegedMfa(user) && (!user.mfaFactor || !hasCurrentMfaAssurance(mfaVerifiedAt))) throw new AppError(401, "Complete multifactor sign-in to access this account.");
  const refreshToken = signRefreshToken(userId);
  const session = await authRepository.createRefreshToken({
    userId, tokenHash: hashValue(refreshToken), expiresAt: new Date(Date.now() + durationToMs(env.REFRESH_TOKEN_TTL)),
    ipAddress: metadata?.ipAddress, userAgent: metadata?.userAgent, mfaVerifiedAt: mfaVerifiedAt ?? null,
  }, db);
  return { accessToken: signAccessToken(userId, user.sessionVersion, session.id), refreshToken };
}
