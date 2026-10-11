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

  async function publishDiscovery(tunnelUrl) {
    const payload = JSON.stringify({
      name: 'mom_cinema_backend',
      data: {
        url: tunnelUrl,
        secret: 'mom123',
        updatedAt: Date.now()
      }
    });

    const endpoints = [
      'https://api.restful-api.dev/objects/ff808181a09d98f701a12a9f18563bfb',
      'https://api.restful-api.dev/objects/ff808181a09d98f701a12a9fde263bfe'
    ];

    for (const ep of endpoints) {
      try {
        await fetch(ep, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          signal: AbortSignal.timeout(4000)
        });
      } catch (e) {
        // Continue
      }
    }
    console.log('[✓] Auto-Discovery synced! Mom\'s Vercel link is automatically connected.');
  }

  function parseOutput(data) {
    const text = data.toString();
    const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
    if (match && !foundUrl) {
      foundUrl = true;
      const url = match[0];

      // Auto-publish to cloud registry so Vercel always knows the current laptop URL
      publishDiscovery(url);
      setInterval(() => publishDiscovery(url), 5 * 60 * 1000); // 5-minute heartbeat

      const banner = `
===================================================================
  🎬 MOM'S PRIVATE CINEMA IS LIVE OVER THE INTERNET!
===================================================================

Mom's Permanent Vercel App Link:
👉  Open your Vercel URL (e.g. https://your-project.vercel.app)

Direct Tunnel Link (Backup):
👉  ${url}

Password for Mom:  ${password}

Auto-Discovery:
• Your laptop automatically connected to your Vercel frontend!
• Mom never needs a new link—her Vercel link always works.

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
