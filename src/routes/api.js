import express from 'express';
import path from 'path';
import fs from 'fs';
import { getMovies, getMovieById, scanLibrary } from '../library/scanner.js';
import { progressStore } from '../progress/progressStore.js';
import { config } from '../config.js';
import { logger } from '../logger.js';

const router = express.Router();

// Get all movies with resume progress attached
router.get('/movies', (req, res) => {
  const movies = getMovies();
  const allProgress = progressStore.getAll();

  const enriched = movies.map((m) => ({
    ...m,
    progress: allProgress[m.id] || null
  }));

  res.json({
    total: enriched.length,
    movies: enriched
  });
});

// Trigger directory rescan
router.post('/movies/scan', async (req, res) => {
  logger.info('Manual library rescan requested via API');
  const movies = await scanLibrary();
  res.json({
    message: 'Library scan completed',
    total: movies.length
  });
});

// Get single movie details
router.get('/movies/:id', (req, res) => {
  const movie = getMovieById(req.params.id);
  if (!movie) {
    return res.status(404).json({ error: 'Movie not found' });
  }

  const progress = progressStore.get(movie.id);
  res.json({
    ...movie,
    progress
  });
});

// Serve cached movie thumbnail
router.get('/movies/:id/thumbnail', (req, res) => {
  const thumbnailPath = path.join(config.thumbnailsDir, `${req.params.id}.jpg`);
  if (fs.existsSync(thumbnailPath)) {
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.sendFile(thumbnailPath);
  }

  // Fallback to a transparent or placeholder SVG if thumbnail not yet ready
  res.status(404).send('Thumbnail not found');
});

// Save playback progress
router.post('/progress/:id', (req, res) => {
  const { currentTime, duration } = req.body;
  const saved = progressStore.save(req.params.id, currentTime, duration);
  res.json({ success: true, progress: saved });
});

// Reset playback progress
router.delete('/progress/:id', (req, res) => {
  progressStore.clear(req.params.id);
  res.json({ success: true, message: 'Progress reset' });
});

// System info
router.get('/system', (req, res) => {
  res.json({
    uptime: Math.round(process.uptime()),
    platform: process.platform,
    nodeVersion: process.version,
    moviesDir: config.moviesDir,
    totalMovies: getMovies().length
  });
});

export default router;
