import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { extractMetadata, generateThumbnail } from './metadata.js';

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mkv', '.avi', '.mov', '.webm', '.m4v']);
const SUBTITLE_EXTENSIONS = new Set(['.srt', '.vtt']);

let moviesCache = [];
let moviesById = new Map();
let isScanning = false;

function cleanTitle(rawName) {
  // Remove file extension
  let name = path.parse(rawName).name;
  // Replace underscores and dots with spaces
  name = name.replace(/[._]/g, ' ');
  // Remove typical scene tags (1080p, 720p, 480p, BluRay, WEBRip, x264, x265, HEVC, AAC, etc.)
  name = name.replace(/\b(1080p|720p|480p|2160p|4k|bluray|webrip|web-dl|hdrip|dvdrip|x264|x265|hevc|h264|aac|dts|yify|rarbg)\b/gi, '');
  // Clean up parenthesis tags e.g. [1080p] or (2023)
  name = name.replace(/\[.*?\]/g, '').replace(/\s+/g, ' ').trim();
  return name || rawName;
}

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '0:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }
  return `${mins}m ${secs}s`;
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 MB';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getMovieId(relPath) {
  return crypto.createHash('sha1').update(relPath).digest('hex').substring(0, 12);
}

function findCompanionSubtitles(videoFilePath, movieBaseName) {
  const dir = path.dirname(videoFilePath);
  const subtitles = [];
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (SUBTITLE_EXTENSIONS.has(ext)) {
        const subBase = path.parse(file).name;
        // Check if subtitle matches the video base name
        if (subBase.startsWith(movieBaseName) || subBase.toLowerCase().includes(movieBaseName.toLowerCase())) {
          let lang = 'English';
          const parts = subBase.split('.');
          if (parts.length > 1) {
            const possibleLang = parts[parts.length - 1].toLowerCase();
            if (['en', 'eng'].includes(possibleLang)) lang = 'English';
            else if (['es', 'spa'].includes(possibleLang)) lang = 'Spanish';
            else if (['fr', 'fre'].includes(possibleLang)) lang = 'French';
            else if (['de', 'ger'].includes(possibleLang)) lang = 'German';
            else if (['it'].includes(possibleLang)) lang = 'Italian';
            else if (['hi'].includes(possibleLang)) lang = 'Hindi';
          }
          subtitles.push({
            id: `external_${subtitles.length}`,
            filePath: path.join(dir, file),
            fileName: file,
            format: ext.replace('.', ''),
            language: lang,
            title: `${lang} (${ext.replace('.', '').toUpperCase()})`,
            isEmbedded: false
          });
        }
      }
    }
  } catch (err) {
    logger.warn(`Error scanning subtitles in ${dir}: ${err.message}`);
  }
  return subtitles;
}

function scanDirRecursive(dir, rootDir, result = []) {
  if (!fs.existsSync(dir)) return result;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDirRecursive(fullPath, rootDir, result);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (VIDEO_EXTENSIONS.has(ext)) {
        const relPath = path.relative(rootDir, fullPath).replace(/\\/g, '/');
        result.push({
          fullPath,
          relPath,
          fileName: entry.name,
          ext
        });
      }
    }
  }
  return result;
}

export async function scanLibrary() {
  if (isScanning) {
    logger.info('Scan already in progress, skipping...');
    return moviesCache;
  }
  isScanning = true;
  logger.info(`Starting video library scan in: ${config.moviesDir}`);

  try {
    const foundFiles = scanDirRecursive(config.moviesDir, config.moviesDir);
    logger.info(`Found ${foundFiles.length} video file(s). Extracting metadata...`);

    const newMovies = [];
    const newMap = new Map();

    for (const file of foundFiles) {
      const id = getMovieId(file.relPath);
      const title = cleanTitle(file.fileName);
      const metadata = await extractMetadata(file.fullPath);
      await generateThumbnail(file.fullPath, id, metadata.duration);

      const companionSubs = findCompanionSubtitles(file.fullPath, path.parse(file.fileName).name);
      const allSubtitles = [...companionSubs, ...metadata.subtitleTracks];

      const movieItem = {
        id,
        title,
        fileName: file.fileName,
        relPath: file.relPath,
        fullPath: file.fullPath,
        extension: file.ext,
        duration: metadata.duration,
        durationFormatted: formatDuration(metadata.duration),
        resolution: `${metadata.width}x${metadata.height}`,
        width: metadata.width,
        height: metadata.height,
        codec: metadata.codec,
        sizeBytes: metadata.sizeBytes,
        sizeFormatted: formatBytes(metadata.sizeBytes),
        audioTracks: metadata.audioTracks,
        subtitles: allSubtitles,
        hasThumbnail: fs.existsSync(path.join(config.thumbnailsDir, `${id}.jpg`)),
        thumbnailUrl: `/api/movies/${id}/thumbnail`,
        canDirectPlay: file.ext === '.mp4' || file.ext === '.webm'
      };

      newMovies.push(movieItem);
      newMap.set(id, movieItem);
    }

    // Sort alphabetically by title
    newMovies.sort((a, b) => a.title.localeCompare(b.title));

    moviesCache = newMovies;
    moviesById = newMap;
    logger.info(`Library scan complete. Indexed ${moviesCache.length} movies.`);
  } catch (err) {
    logger.error(`Error scanning library: ${err.message}`);
  } finally {
    isScanning = false;
  }

  return moviesCache;
}

export function getMovies() {
  return moviesCache;
}

export function getMovieById(id) {
  return moviesById.get(id) || null;
}
