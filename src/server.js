import express from 'express';
import http from 'http';
import path from 'path';
import session from 'express-session';
import { Server as SocketIOServer } from 'socket.io';
import { config } from './config.js';
import { logger } from './logger.js';
import { requireAuth, loginLimiter } from './auth/authMiddleware.js';
import { authController } from './auth/authController.js';
import { scanLibrary } from './library/scanner.js';
import { setupWatchTogether } from './sync/watchTogether.js';
import apiRouter from './routes/api.js';
import streamRouter from './routes/stream.js';

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});
setupWatchTogether(io);

// Enable CORS for Vercel & remote frontends
app.use((req, res, next) => {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Range, Cookie, x-backend-url');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration (30-day persistent cookie for Mom)
app.use(
  session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      sameSite: 'lax',
      secure: false // Set to true if running behind HTTPS with trust proxy
    }
  })
);

// If behind reverse proxy (Cloudflare Tunnel, Tailscale, Nginx)
app.set('trust proxy', 1);

// Auth endpoints (public)
app.post('/api/auth/login', loginLimiter, authController.login);
app.post('/api/auth/logout', authController.logout);
app.get('/api/auth/status', authController.status);

// Protect all remaining routes with authentication
app.use(requireAuth);

// Static assets from public folder
const publicDir = path.join(config.rootDir, 'public');
app.use(express.static(publicDir));

// Protected API and streaming routes
app.use('/api', apiRouter);
app.use('/stream', streamRouter);

// Fallback to index.html for SPA-like navigation
app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(`Unhandled Server Error: ${err.message}`, err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start listening
server.listen(config.port, config.host, async () => {
  logger.info('========================================================');
  logger.info(` Private Family Movie Stream Server is RUNNING`);
  logger.info(` Local Access:        http://localhost:${config.port}`);
  logger.info(` LAN / Network Access: http://${config.host}:${config.port}`);
  logger.info(` Shared Password:     ${config.streamPassword}`);
  logger.info(` Movies Directory:    ${config.moviesDir}`);
  logger.info('========================================================');

  // Initial library scan
  try {
    await scanLibrary();
  } catch (err) {
    logger.error(`Initial scan failed: ${err.message}`);
  }
});
