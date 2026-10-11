import fs from 'fs';
import path from 'path';
import { config } from './config.js';

const logFilePath = path.join(config.logsDir, 'app.log');
const errorLogFilePath = path.join(config.logsDir, 'error.log');

function formatTimestamp() {
  return new Date().toISOString();
}

function writeToFile(filePath, message) {
  try {
    fs.appendFileSync(filePath, message + '\n', 'utf8');
  } catch (err) {
    console.error('Failed to write to log file:', err);
  }
}

export const logger = {
  info(msg, ...args) {
    const formatted = `[${formatTimestamp()}] [INFO] ${msg} ${args.length ? JSON.stringify(args) : ''}`;
    console.log('\x1b[36m' + formatted + '\x1b[0m');
    writeToFile(logFilePath, formatted);
  },
  warn(msg, ...args) {
    const formatted = `[${formatTimestamp()}] [WARN] ${msg} ${args.length ? JSON.stringify(args) : ''}`;
    console.warn('\x1b[33m' + formatted + '\x1b[0m');
    writeToFile(logFilePath, formatted);
  },
  error(msg, ...args) {
    const formatted = `[${formatTimestamp()}] [ERROR] ${msg} ${args.length ? JSON.stringify(args) : ''}`;
    console.error('\x1b[31m' + formatted + '\x1b[0m');
    writeToFile(logFilePath, formatted);
    writeToFile(errorLogFilePath, formatted);
  },
  stream(msg, ...args) {
    const formatted = `[${formatTimestamp()}] [STREAM] ${msg} ${args.length ? JSON.stringify(args) : ''}`;
    console.log('\x1b[35m' + formatted + '\x1b[0m');
    writeToFile(logFilePath, formatted);
  }
};
