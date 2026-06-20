// middleware/rateLimit.js (ESM version)
import rateLimit from "express-rate-limit";

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 0.5 * 60 * 1000, // 15 minutes
  max: 10000, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: "Too many requests from this IP, please try again after 15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict limiter for auth endpoints (prevent brute force)
const authLimiter = rateLimit({
  windowMs: 0.5 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 10 login attempts
  skipSuccessfulRequests: true, // Don't count successful logins
  message: {
    success: false,
    error: "Too many login attempts, please try again after 15 minutes",
  },
});

// SOS endpoint limiter (prevent spam)
const sosLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 3, // Max 3 SOS calls per minute
  message: {
    success: false,
    error:
      "Too many SOS calls. Please wait before making another emergency call.",
  },
});

export { apiLimiter, authLimiter, sosLimiter };
