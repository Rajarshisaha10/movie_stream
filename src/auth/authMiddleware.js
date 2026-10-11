import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import { config } from '../config.js';
import { logger } from '../logger.js';

// Rate limiter for login route: max 15 requests per 15 minutes per IP
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: {
    success: false,
    error: 'Too many incorrect attempts. Please wait a few minutes or ask family for help.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip} on /api/auth/login`);
    res.status(429).json(options.message);
  }
});

export function generateAuthToken() {
  return crypto.createHmac('sha256', config.sessionSecret).update(config.streamPassword).digest('hex');
}

export function isValidToken(token) {
  if (!token) return false;
  const expected = generateAuthToken();
  return token === expected || token === config.streamPassword;
}

/**
 * Middleware ensuring user is authenticated via Token (header/query) or Session cookie
 */
export function requireAuth(req, res, next) {
  // Allow public assets & auth endpoints
  if (
    req.path === '/login.html' ||
    req.path === '/login' ||
    req.path.startsWith('/api/auth') ||
    req.path.startsWith('/css/') ||
    req.path.startsWith('/js/') ||
    req.path.startsWith('/favicon.ico')
  ) {
    return next();
  }

  // 1. Check Bearer Token, custom header, or URL query param (essential for cross-domain Vercel & native mobile video)
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const candidateToken = bearerToken || req.headers['x-auth-token'] || req.query.token;

  if (candidateToken && isValidToken(candidateToken)) {
    return next();
  }

  // 2. Check Session Cookie fallback
  if (req.session && req.session.authenticated) {
    return next();
  }

  // If API or stream request, return 401 Unauthorized JSON
  if (req.path.startsWith('/api/') || req.path.startsWith('/stream/')) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }

  // Otherwise redirect browser to login page
  res.redirect('/login.html');
}
