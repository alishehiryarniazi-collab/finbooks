import rateLimit from "express-rate-limit";

// Rate limiting protects against brute-force logins, credential stuffing, and basic
// request floods. Behind Nginx we set `trust proxy` so the real client IP (from
// X-Forwarded-For) is used as the key — otherwise every request would look like it
// came from the proxy (127.0.0.1) and share one bucket.

// Generous global backstop against request floods. Small teams often share one office
// IP and each app screen loads ~10 endpoints, so this is set high enough to never get
// in the way of normal use.
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 1000,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down and try again shortly." },
});

// Strict limiter for auth-sensitive endpoints (login, register, forgot/reset password)
// to stop password guessing. Successful logins don't really need many retries.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many attempts. Please wait a few minutes and try again." },
});
