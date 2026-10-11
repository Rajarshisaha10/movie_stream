import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const cloudflaredBin = path.join(rootDir, 'bin', 'cloudflared.exe');
const password = process.env.STREAM_PASSWORD || 'mom123';
const port = process.env.PORT || '3000';

if (!fs.existsSync(cloudflaredBin)) {
  console.error(`cloudflared binary not found at ${cloudflaredBin}. Please check bin folder.`);
  process.exit(1);
}

console.log('Connecting to Cloudflare global network to establish secure tunnel...');

const args = ['tunnel', '--url', `http://127.0.0.1:${port}`];
const proc = spawn(cloudflaredBin, args, { stdio: ['ignore', 'pipe', 'pipe'] });

let foundUrl = false;

function parseOutput(data) {
  const text = data.toString();
  // Look for https://...trycloudflare.com
  const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
  if (match && !foundUrl) {
    foundUrl = true;
    const url = match[0];

    const banner = `
===================================================================
  🎬 MOM'S PRIVATE CINEMA IS LIVE OVER THE INTERNET!
===================================================================

Send this link to Mom (copy and send via WhatsApp / SMS / iMessage):

👉  ${url}

Password for Mom:  ${password}

Tips for Mom:
• Open on iPhone, iPad, Android phone, tablet, or TV browser.
• On iPhone / iPad: Tap 'Share' -> 'Add to Home Screen' to make it look like an app!
• Subtitles, 10s skip, and adaptive qualities are automatically enabled.

Keep this terminal window open while Mom is watching.
===================================================================
`;
    console.log(banner);

    // Save link to file so user has an easy reference
    fs.writeFileSync(path.join(rootDir, 'MOM_STREAM_LINK.txt'), banner, 'utf8');
  }
}

proc.stdout.on('data', parseOutput);
proc.stderr.on('data', parseOutput);

proc.on('close', (code) => {
  console.log(`Cloudflare tunnel exited with code ${code}`);
});

proc.on('error', (err) => {
  console.error('Failed to start Cloudflare tunnel:', err.message);
});
