import express from 'express';
import { getMovieById } from '../library/scanner.js';
import { handleDirectPlay } from '../stream/directPlayService.js';
import {
  generateMasterPlaylist,
  handleHlsPlaylist,
  handleHlsSegment,
  getAvailableQualities
} from '../stream/hlsService.js';
import { serveSubtitle } from '../stream/subtitleService.js';
import { logger } from '../logger.js';

const router = express.Router();

// Direct Play with HTTP 206 Partial Content Range Requests
router.get('/direct/:id', (req, res) => {
  const movie = getMovieById(req.params.id);
  if (!movie) {
    return res.status(404).send('Movie not found');
  }
  handleDirectPlay(req, res, movie.fullPath);
});

// Master HLS Adaptive Playlist
router.get('/hls/:id/master.m3u8', (req, res) => {
  const movie = getMovieById(req.params.id);
  if (!movie) {
    return res.status(404).send('Movie not found');
  }

  const masterPlaylist = generateMasterPlaylist(movie);
  res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
  res.setHeader('Cache-Control', 'no-cache');
  res.send(masterPlaylist);
});

// Specific Quality Playlist (e.g. /stream/hls/:id/720p/index.m3u8)
router.get('/hls/:id/:quality/index.m3u8', async (req, res) => {
  const { id, quality } = req.params;
  const movie = getMovieById(id);
  if (!movie) {
    return res.status(404).send('Movie not found');
  }

  const validQualities = ['1080p', '720p', '480p'];
  if (!validQualities.includes(quality)) {
    return res.status(400).send('Invalid quality profile');
  }

  try {
    await handleHlsPlaylist(req, res, movie, quality);
  } catch (err) {
    logger.error(`Error generating HLS playlist for ${id} (${quality}): ${err.message}`);
    res.status(500).send('Transcoding error');
  }
});

// HLS Segment (.ts file)
router.get('/hls/:id/:quality/:segment', (req, res) => {
  const { id, quality, segment } = req.params;
  handleHlsSegment(req, res, id, quality, segment);
});

// Subtitles stream
router.get('/subtitles/:id/:subId', async (req, res) => {
  const movie = getMovieById(req.params.id);
  if (!movie) {
    return res.status(404).send('Movie not found');
  }

  await serveSubtitle(req, res, movie, req.params.subId);
});

export default router;
