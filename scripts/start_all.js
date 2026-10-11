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

console.log('===================================================================');
console.log('   🎬 STARTING FAMILY CINEMA STREAMING HOST');
console.log('===================================================================');

// 1. Start the Express server directly
console.log(`[*] Starting Express Streaming Server on port ${port}...`);
import('../src/server.js').then(() => {
  console.log('[✓] Express Streaming Server is active and listening!');

  // 2. Start Cloudflare Tunnel
  if (!fs.existsSync(cloudflaredBin)) {
    console.error(`\n[!] Cloudflare executable not found at ${cloudflaredBin}`);
    console.log(`    Local access only: http://localhost:${port}`);
    return;
  }

  console.log('[*] Connecting to Cloudflare global network to create Mom\'s link...\n');

  const args = ['tunnel', '--url', `http://127.0.0.1:${port}`];
  const proc = spawn(cloudflaredBin, args, { stdio: ['ignore', 'pipe', 'pipe'] });

  let foundUrl = false;

  function parseOutput(data) {
    const text = data.toString();
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
• On iPhone / iPad: Tap 'Share' -> 'Add to Home Screen' for app icon.
• Subtitles, 10s rewind, and adaptive qualities are ready!

KEEP THIS WINDOW OPEN while Mom is watching.
===================================================================
`;
      console.log(banner);
      fs.writeFileSync(path.join(rootDir, 'MOM_STREAM_LINK.txt'), banner, 'utf8');
    }
  }

  proc.stdout.on('data', parseOutput);
  proc.stderr.on('data', parseOutput);

  proc.on('close', (code) => {
    console.log(`Cloudflare tunnel process exited with code ${code}`);
  });

  process.on('SIGINT', () => {
    proc.kill();
    process.exit();
  });
}).catch((err) => {
  console.error('[!] Failed to start Express server:', err);
});
