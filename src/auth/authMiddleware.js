import rateLimit from 'express-rate-limit';
import { logger } from '../logger.js';

// Rate limiter for login route: max 5 requests per 15 minutes per IP
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    error: 'Too many incorrect attempts. Please wait 15 minutes or ask family for help.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip} on /api/auth/login`);
    res.status(429).json(options.message);
  }
});

/**
 * Middleware ensuring user is authenticated via session cookie
 */
export function requireAuth(req, res, next) {
  // Allow login page, static assets for login, and auth endpoints
  if (
    req.path === '/login.html' ||
    req.path.startsWith('/api/auth') ||
    req.path.startsWith('/css/') ||
    req.path.startsWith('/favicon.ico')
  ) {
    return next();
  }

  if (req.session && req.session.authenticated) {
    return next();
  }

  // If API request, return 401 Unauthorized JSON
  if (req.path.startsWith('/api/') || req.path.startsWith('/stream/')) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }

  // Otherwise redirect browser to login page
  res.redirect('/login.html');
}
