import fs from 'fs';
import path from 'path';
import { config } from '../config.js';
import { logger } from '../logger.js';

const progressFile = path.join(config.cacheDir, 'progress.json');

let progressData = {};

function loadProgress() {
  try {
    if (fs.existsSync(progressFile)) {
      const raw = fs.readFileSync(progressFile, 'utf8');
      progressData = JSON.parse(raw);
    }
  } catch (err) {
    logger.error(`Error loading progress file: ${err.message}`);
    progressData = {};
  }
}

function saveToFile() {
  try {
    fs.writeFileSync(progressFile, JSON.stringify(progressData, null, 2), 'utf8');
  } catch (err) {
    logger.error(`Error saving progress file: ${err.message}`);
  }
}

// Initial load
loadProgress();

export const progressStore = {
  save(movieId, currentTime, duration) {
    if (!movieId) return;
    const dur = Math.max(1, duration || 1);
    const time = Math.max(0, currentTime || 0);
    const percentage = Math.min(100, Math.round((time / dur) * 100));
    const completed = percentage >= 92;

    progressData[movieId] = {
      currentTime: time,
      duration: dur,
      percentage,
      completed,
      updatedAt: new Date().toISOString()
    };

    saveToFile();
    return progressData[movieId];
  },

  get(movieId) {
    return progressData[movieId] || null;
  },

  getAll() {
    return progressData;
  },

  clear(movieId) {
    if (progressData[movieId]) {
      delete progressData[movieId];
      saveToFile();
    }
  }
};
