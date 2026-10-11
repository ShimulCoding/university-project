import rateLimit from "express-rate-limit";

/**
 * Strict rate limiter for sensitive auth endpoints (login, register, bootstrap-admin).
 * Limits each IP to 10 requests per 15 minutes to prevent brute-force attacks.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many authentication attempts. Please try again later." },
});

// Successful sign-ins must not exhaust the shared campus IP's failure budget.
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many failed sign-in attempts. Please try again later." },
});

/**
 * Lighter rate limiter for session refresh and logout endpoints.
 * Limits each IP to 30 requests per 15 minutes.
 */
export const sessionRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many session requests. Please try again later." },
});

// Identity/ticket failure budgets are enforced transactionally by the MFA
// service. This outer IP budget bounds invalid-ticket flooding without sharing
// a tiny code allowance across everyone on a campus network.
export const mfaRateLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 200, standardHeaders: "draft-7", legacyHeaders: false, message: { message: "Too many verification requests. Please try again later." } });
