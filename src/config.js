import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const resolveDir = (p) => {
  return path.isAbsolute(p) ? p : path.resolve(rootDir, p);
};

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  streamPassword: process.env.STREAM_PASSWORD || 'mom123',
  sessionSecret: process.env.SESSION_SECRET || 'secret-movie-stream-key-2026',
  moviesDir: resolveDir(process.env.MOVIES_DIR || './movies'),
  cacheDir: resolveDir(process.env.CACHE_DIR || './cache'),
  ffmpegThreads: parseInt(process.env.FFMPEG_THREADS || '0', 10),
  hlsSegmentDuration: parseInt(process.env.HLS_SEGMENT_DURATION || '4', 10),
  rootDir,
  thumbnailsDir: path.join(resolveDir(process.env.CACHE_DIR || './cache'), 'thumbnails'),
  hlsDir: path.join(resolveDir(process.env.CACHE_DIR || './cache'), 'hls'),
  logsDir: path.join(rootDir, 'logs')
};

// Ensure required directories exist
for (const dir of [config.moviesDir, config.cacheDir, config.thumbnailsDir, config.hlsDir, config.logsDir]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
