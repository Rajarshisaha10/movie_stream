import { config } from '../config.js';
import { logger } from '../logger.js';
import { generateAuthToken, isValidToken } from './authMiddleware.js';

export const authController = {
  login(req, res) {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ success: false, error: 'Please enter password' });
    }

    if (password.trim() === config.streamPassword) {
      const token = generateAuthToken();
      if (req.session) {
        req.session.authenticated = true;
        req.session.loginTime = new Date().toISOString();
      }
      logger.info(`Successful login from IP: ${req.ip}`);
      return res.json({
        success: true,
        token: token,
        message: 'Welcome to Family Cinema!'
      });
    }

    logger.warn(`Failed login attempt with incorrect password from IP: ${req.ip}`);
    return res.status(401).json({ success: false, error: 'Incorrect password. Please try again.' });
  },

  logout(req, res) {
    if (req.session) {
      req.session.destroy(() => {});
    }
    res.clearCookie('connect.sid');
    res.json({ success: true, message: 'Logged out successfully' });
  },

  status(req, res) {
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    const candidateToken = bearerToken || req.headers['x-auth-token'] || req.query.token;
    const isTokenValid = candidateToken && isValidToken(candidateToken);
    const isAuthenticated = Boolean(isTokenValid || (req.session && req.session.authenticated));
    res.json({ authenticated: isAuthenticated });
  }
};
