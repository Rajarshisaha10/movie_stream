import { config } from '../config.js';
import { logger } from '../logger.js';

export const authController = {
  login(req, res) {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ success: false, error: 'Please enter password' });
    }

    if (password.trim() === config.streamPassword) {
      req.session.authenticated = true;
      req.session.loginTime = new Date().toISOString();
      logger.info(`Successful login from IP: ${req.ip}`);
      return res.json({ success: true, message: 'Welcome to Family Cinema!' });
    }

    logger.warn(`Failed login attempt with incorrect password from IP: ${req.ip}`);
    return res.status(401).json({ success: false, error: 'Incorrect password. Please try again.' });
  },

  logout(req, res) {
    req.session.destroy((err) => {
      if (err) {
        logger.error(`Error destroying session: ${err.message}`);
        return res.status(500).json({ success: false, error: 'Could not log out' });
      }
      res.clearCookie('connect.sid');
      res.json({ success: true, message: 'Logged out successfully' });
    });
  },

  status(req, res) {
    const isAuthenticated = Boolean(req.session && req.session.authenticated);
    res.json({ authenticated: isAuthenticated });
  }
};
