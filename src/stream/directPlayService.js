import fs from 'fs';
import path from 'path';
import { logger } from '../logger.js';

const MIME_MAP = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
  '.mov': 'video/quicktime'
};

export function handleDirectPlay(req, res, filePath) {
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Movie file not found');
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_MAP[ext] || 'video/mp4';

  if (range) {
    // Example range: "bytes=1048576-" or "bytes=0-1048575"
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    // Chunk size limit: 5MB per chunk helps smooth buffering and prevents excessive memory usage
    const CHUNK_SIZE = 5 * 1024 * 1024;
    const requestedEnd = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const end = Math.min(requestedEnd, start + CHUNK_SIZE - 1, fileSize - 1);

    if (start >= fileSize) {
      res.status(416).set({
        'Content-Range': `bytes */${fileSize}`
      }).send('Requested range not satisfiable');
      return;
    }

    const chunkLength = end - start + 1;
    const headers = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkLength,
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    };

    res.writeHead(206, headers);
    const stream = fs.createReadStream(filePath, { start, end });

    stream.on('error', (err) => {
      logger.error(`Stream error for ${filePath}: ${err.message}`);
      if (!res.headersSent) res.status(500).end();
    });

    res.on('close', () => {
      stream.destroy();
    });

    stream.pipe(res);
  } else {
    // No range header: return entire file with Accept-Ranges
    const headers = {
      'Content-Length': fileSize,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes'
    };
    res.writeHead(200, headers);
    const stream = fs.createReadStream(filePath);

    res.on('close', () => {
      stream.destroy();
    });

    stream.pipe(res);
  }
}
