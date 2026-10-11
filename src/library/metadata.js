import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { config } from '../config.js';
import { logger } from '../logger.js';

/**
 * Runs ffprobe to extract video metadata
 */
export async function extractMetadata(filePath) {
  return new Promise((resolve) => {
    const args = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath
    ];

    const proc = spawn('ffprobe', args);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => { stdout += d; });
    proc.stderr.on('data', (d) => { stderr += d; });

    proc.on('close', (code) => {
      if (code !== 0) {
        logger.warn(`ffprobe exited with code ${code} for file ${filePath}`);
        return resolve({
          duration: 0,
          width: 1920,
          height: 1080,
          codec: 'unknown',
          audioTracks: [],
          subtitleTracks: []
        });
      }

      try {
        const data = JSON.parse(stdout);
        const format = data.format || {};
        const streams = data.streams || [];

        const videoStream = streams.find((s) => s.codec_type === 'video') || {};
        const audioStreams = streams.filter((s) => s.codec_type === 'audio');
        const subtitleStreams = streams.filter((s) => s.codec_type === 'subtitle');

        const duration = parseFloat(format.duration || videoStream.duration || 0);
        const width = videoStream.width || 1920;
        const height = videoStream.height || 1080;
        const videoCodec = videoStream.codec_name || 'unknown';

        const audioTracks = audioStreams.map((s, idx) => ({
          index: s.index,
          id: idx,
          codec: s.codec_name,
          language: s.tags?.language || s.tags?.LANGUAGE || `Audio ${idx + 1}`,
          channels: s.channels || 2,
          title: s.tags?.title || s.tags?.TITLE || (s.channels === 6 ? '5.1 Surround' : 'Stereo')
        }));

        const embeddedSubtitles = subtitleStreams.map((s, idx) => ({
          index: s.index,
          id: `embedded_${idx}`,
          codec: s.codec_name,
          language: s.tags?.language || s.tags?.LANGUAGE || `Track ${idx + 1}`,
          title: s.tags?.title || s.tags?.TITLE || `Subtitle ${idx + 1}`,
          isEmbedded: true
        }));

        resolve({
          duration,
          width,
          height,
          codec: videoCodec,
          sizeBytes: parseInt(format.size || '0', 10),
          bitrate: parseInt(format.bit_rate || '0', 10),
          audioTracks,
          subtitleTracks: embeddedSubtitles
        });
      } catch (err) {
        logger.error(`Failed to parse ffprobe JSON for ${filePath}: ${err.message}`);
        resolve({
          duration: 0,
          width: 1920,
          height: 1080,
          codec: 'unknown',
          audioTracks: [],
          subtitleTracks: []
        });
      }
    });

    proc.on('error', (err) => {
      logger.error(`Error spawning ffprobe: ${err.message}`);
      resolve({
        duration: 0,
        width: 1920,
        height: 1080,
        codec: 'unknown',
        audioTracks: [],
        subtitleTracks: []
      });
    });
  });
}

/**
 * Generates and caches thumbnail image using ffmpeg
 */
export async function generateThumbnail(filePath, movieId, duration = 30) {
  const thumbnailPath = path.join(config.thumbnailsDir, `${movieId}.jpg`);

  if (fs.existsSync(thumbnailPath)) {
    return thumbnailPath;
  }

  return new Promise((resolve) => {
    // Pick timestamp at 15% mark or fallback to 5 seconds
    const seekSec = duration > 10 ? Math.floor(duration * 0.15) : Math.max(1, Math.floor(duration / 2));

    const args = [
      '-y',
      '-ss', seekSec.toString(),
      '-i', filePath,
      '-map', '0:v:0',
      '-vframes', '1',
      '-q:v', '3',
      '-vf', 'scale=640:-1',
      thumbnailPath
    ];

    const proc = spawn('ffmpeg', args);

    proc.on('close', (code) => {
      if (code === 0 && fs.existsSync(thumbnailPath)) {
        logger.info(`Generated thumbnail for ${movieId} at ${thumbnailPath}`);
        resolve(thumbnailPath);
      } else {
        logger.warn(`Failed to generate thumbnail for ${movieId}, exit code: ${code}`);
        resolve(null);
      }
    });

    proc.on('error', (err) => {
      logger.error(`Error generating thumbnail for ${movieId}: ${err.message}`);
      resolve(null);
    });
  });
}
