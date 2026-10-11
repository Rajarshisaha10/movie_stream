import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { config } from '../config.js';
import { logger } from '../logger.js';

// Active transcoding jobs: key = `${movieId}_${quality}`
const activeJobs = new Map();

const QUALITIES = {
  '1080p': {
    name: '1080p',
    width: 1920,
    height: 1080,
    bitrate: '2800k',
    maxrate: '3200k',
    bufsize: '5000k',
    audioBitrate: '192k',
    bandwidth: 3000000
  },
  '720p': {
    name: '720p',
    width: 1280,
    height: 720,
    bitrate: '1400k',
    maxrate: '1800k',
    bufsize: '2800k',
    audioBitrate: '128k',
    bandwidth: 1600000
  },
  '480p': {
    name: '480p',
    width: 854,
    height: 480,
    bitrate: '700k',
    maxrate: '900k',
    bufsize: '1400k',
    audioBitrate: '96k',
    bandwidth: 850000
  }
};

/**
 * Returns available quality profiles for a movie based on its native resolution
 */
export function getAvailableQualities(movie) {
  const height = movie.height || 1080;
  const list = [];
  if (height >= 900) list.push('1080p');
  if (height >= 600) list.push('720p');
  list.push('480p');
  return list;
}

/**
 * Generates Master HLS Playlist (master.m3u8) for adaptive streaming
 */
export function generateMasterPlaylist(movie) {
  const available = getAvailableQualities(movie);
  // Prioritize 720p first for instant mobile buffering without lag
  const priority = ['720p', '480p', '1080p'];
  const ordered = priority.filter((q) => available.includes(q));

  let lines = [
    '#EXTM3U',
    '#EXT-X-VERSION:3'
  ];

  for (const q of ordered) {
    const profile = QUALITIES[q];
    lines.push(
      `#EXT-X-STREAM-INF:BANDWIDTH=${profile.bandwidth},RESOLUTION=${profile.width}x${profile.height},NAME="${profile.name}"`,
      `${q}/index.m3u8`
    );
  }

  return lines.join('\n') + '\n';
}

/**
 * Starts or monitors progressive HLS transcoding job for a given movie and quality
 */
export function startHlsTranscode(movie, quality) {
  const profile = QUALITIES[quality] || QUALITIES['720p'];
  const movieHlsDir = path.join(config.hlsDir, movie.id, quality);

  if (!fs.existsSync(movieHlsDir)) {
    fs.mkdirSync(movieHlsDir, { recursive: true });
  }

  const playlistFile = path.join(movieHlsDir, 'index.m3u8');
  const jobKey = `${movie.id}_${quality}`;

  // If already finished transcoding VOD, nothing to spawn
  if (fs.existsSync(playlistFile)) {
    try {
      const content = fs.readFileSync(playlistFile, 'utf8');
      if (content.includes('#EXT-X-ENDLIST')) {
        return Promise.resolve({ completed: true, dir: movieHlsDir, playlistFile });
      }
    } catch {
      // Continue to check active job
    }
  }

  // If job is already active, return the existing promise
  if (activeJobs.has(jobKey)) {
    return activeJobs.get(jobKey).readyPromise;
  }

  logger.info(`Starting HLS transcode job [${jobKey}] for ${movie.title} (${quality})...`);

  let resolveReady;
  const readyPromise = new Promise((resolve) => {
    resolveReady = resolve;
  });

  const threads = config.ffmpegThreads > 0 ? ['-threads', config.ffmpegThreads.toString()] : [];
  
  // FFmpeg command to produce HLS with fast start
  // Uses -preset veryfast / ultrafast for low latency on laptop
  const scaleFilter = `scale=w=${profile.width}:h=${profile.height}:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2`;

  const ffmpegArgs = [
    '-y',
    ...threads,
    '-i', movie.fullPath,
    '-map', '0:v:0',
    '-map', '0:a:0?',
    '-vf', scaleFilter,
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-tune', 'fastdecode',
    '-crf', '22',
    '-b:v', profile.bitrate,
    '-maxrate', profile.maxrate,
    '-bufsize', profile.bufsize,
    '-pix_fmt', 'yuv420p',
    '-g', '60',
    '-keyint_min', '60',
    '-sc_threshold', '0',
    '-c:a', 'aac',
    '-b:a', profile.audioBitrate,
    '-ac', '2',
    '-ar', '44100',
    '-f', 'hls',
    '-hls_time', config.hlsSegmentDuration.toString(),
    '-hls_list_size', '0', // Keep all segments in playlist as VOD
    '-hls_playlist_type', 'event',
    '-hls_flags', 'temp_file',
    '-hls_segment_filename', path.join(movieHlsDir, 'segment_%04d.ts'),
    playlistFile
  ];

  const proc = spawn('ffmpeg', ffmpegArgs);
  let resolved = false;

  // Watch for the first segments and playlist to become ready
  const checkInterval = setInterval(() => {
    if (fs.existsSync(playlistFile)) {
      try {
        const content = fs.readFileSync(playlistFile, 'utf8');
        // As soon as at least 1 or 2 segments are written or playlist exists, signal ready
        if (content.includes('segment_') && !resolved) {
          resolved = true;
          clearInterval(checkInterval);
          logger.info(`HLS initial buffer ready for [${jobKey}]`);
          resolveReady({ completed: false, dir: movieHlsDir, playlistFile });
        }
      } catch {
        // file might be locked briefly by ffmpeg writing
      }
    }
  }, 400);

  // Fallback timer: resolve after 4 seconds even if check interval hasn't detected segment
  const timeoutTimer = setTimeout(() => {
    if (!resolved) {
      resolved = true;
      clearInterval(checkInterval);
      resolveReady({ completed: false, dir: movieHlsDir, playlistFile });
    }
  }, 4000);

  proc.stderr.on('data', (data) => {
    // Only log errors or occasional status
    const msg = data.toString();
    if (msg.toLowerCase().includes('error')) {
      logger.warn(`[FFmpeg HLS ${jobKey}] ${msg.trim()}`);
    }
  });

  proc.on('close', (code) => {
    clearInterval(checkInterval);
    clearTimeout(timeoutTimer);
    activeJobs.delete(jobKey);

    if (code === 0) {
      logger.info(`HLS transcode job [${jobKey}] finished successfully!`);
      // Append ENDLIST if needed to ensure clean VOD completion
      try {
        if (fs.existsSync(playlistFile)) {
          let text = fs.readFileSync(playlistFile, 'utf8');
          if (!text.includes('#EXT-X-ENDLIST')) {
            fs.appendFileSync(playlistFile, '#EXT-X-ENDLIST\n');
          }
        }
      } catch (e) {
        logger.error(`Error appending ENDLIST for [${jobKey}]: ${e.message}`);
      }
    } else {
      logger.warn(`HLS transcode job [${jobKey}] exited with code ${code}`);
    }

    if (!resolved) {
      resolved = true;
      resolveReady({ completed: code === 0, dir: movieHlsDir, playlistFile });
    }
  });

  proc.on('error', (err) => {
    clearInterval(checkInterval);
    clearTimeout(timeoutTimer);
    activeJobs.delete(jobKey);
    logger.error(`Failed to spawn FFmpeg for [${jobKey}]: ${err.message}`);
    if (!resolved) {
      resolved = true;
      resolveReady({ completed: false, dir: movieHlsDir, playlistFile });
    }
  });

  activeJobs.set(jobKey, {
    proc,
    readyPromise,
    startTime: Date.now()
  });

  return readyPromise;
}

/**
 * Handles serving Master and Variant Playlists (.m3u8) and Segments (.ts)
 */
export async function handleHlsPlaylist(req, res, movie, quality) {
  const movieHlsDir = path.join(config.hlsDir, movie.id, quality);
  const playlistFile = path.join(movieHlsDir, 'index.m3u8');

  // Start transcode if not already running or completed
  await startHlsTranscode(movie, quality);

  // Wait briefly for playlist file to appear if it's the very first millisecond
  let attempts = 0;
  while (!fs.existsSync(playlistFile) && attempts < 15) {
    await new Promise((r) => setTimeout(r, 200));
    attempts++;
  }

  if (!fs.existsSync(playlistFile)) {
    return res.status(503).send('Transcoding initializing, please retry in a moment...');
  }

  res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(playlistFile);
}

export function handleHlsSegment(req, res, movieId, quality, segmentName) {
  const segmentPath = path.join(config.hlsDir, movieId, quality, segmentName);

  if (!fs.existsSync(segmentPath)) {
    // If segment is not yet generated, wait up to 3 seconds for active transcode to write it
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (fs.existsSync(segmentPath)) {
        clearInterval(interval);
        res.setHeader('Content-Type', 'video/MP2T');
        res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache segments permanently
        return res.sendFile(segmentPath);
      }
      if (attempts >= 15) {
        clearInterval(interval);
        return res.status(404).send('Segment not found yet');
      }
    }, 200);
    return;
  }

  res.setHeader('Content-Type', 'video/MP2T');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(segmentPath);
}
