import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { config } from '../config.js';
import { logger } from '../logger.js';

const subtitleCacheDir = path.join(config.cacheDir, 'subtitles');
if (!fs.existsSync(subtitleCacheDir)) {
  fs.mkdirSync(subtitleCacheDir, { recursive: true });
}

export function convertSrtToVtt(srtText) {
  // Normalize line endings
  let text = srtText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  // Replace SRT comma millisecond format with WebVTT dot format
  text = text.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  return `WEBVTT\n\n${text}`;
}

export async function serveSubtitle(req, res, movie, subId) {
  const subtitle = movie.subtitles.find((s) => s.id === subId);
  if (!subtitle) {
    return res.status(404).send('Subtitle track not found');
  }

  res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Case 1: External file (.srt or .vtt)
  if (!subtitle.isEmbedded && subtitle.filePath) {
    try {
      const content = fs.readFileSync(subtitle.filePath, 'utf8');
      if (subtitle.format === 'srt') {
        const vtt = convertSrtToVtt(content);
        return res.send(vtt);
      }
      return res.send(content);
    } catch (err) {
      logger.error(`Error reading subtitle file ${subtitle.filePath}: ${err.message}`);
      return res.status(500).send('Error reading subtitle');
    }
  }

  // Case 2: Embedded subtitle track in MKV/MP4
  if (subtitle.isEmbedded) {
    const cachedVttPath = path.join(subtitleCacheDir, `${movie.id}_${subtitle.index}.vtt`);
    if (fs.existsSync(cachedVttPath)) {
      return res.sendFile(cachedVttPath);
    }

    // Extract using ffmpeg to WebVTT
    const proc = spawn('ffmpeg', [
      '-y',
      '-i', movie.fullPath,
      '-map', `0:${subtitle.index}`,
      '-f', 'webvtt',
      cachedVttPath
    ]);

    proc.on('close', (code) => {
      if (code === 0 && fs.existsSync(cachedVttPath)) {
        res.sendFile(cachedVttPath);
      } else {
        logger.warn(`Failed to extract embedded subtitle track ${subtitle.index} from ${movie.fullPath}`);
        res.status(500).send('Failed to extract subtitle');
      }
    });

    proc.on('error', (err) => {
      logger.error(`Error extracting subtitle: ${err.message}`);
      res.status(500).send('Subtitle extraction error');
    });
  }
}
