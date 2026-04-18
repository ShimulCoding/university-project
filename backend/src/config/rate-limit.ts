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
