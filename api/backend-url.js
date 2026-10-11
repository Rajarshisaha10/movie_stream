// Vercel Serverless Endpoint to discover the live laptop backend URL
const PRIMARY_REGISTRY = 'https://api.restful-api.dev/objects/ff808181a09d98f701a12a9f18563bfb';
const BACKUP_REGISTRY = 'https://api.restful-api.dev/objects/ff808181a09d98f701a12a9fde263bfe';

let cachedBackendUrl = '';
let lastFetchTime = 0;
const CACHE_TTL_MS = 15000; // 15s in-memory cache

export async function getLiveBackendUrl() {
  const envUrl = process.env.BACKEND_URL;
  // If user configured a permanent non-trycloudflare domain in env, prefer it
  if (envUrl && !envUrl.includes('trycloudflare.com')) {
    return envUrl.replace(/\/+$/, '');
  }

  const now = Date.now();
  if (cachedBackendUrl && (now - lastFetchTime < CACHE_TTL_MS)) {
    return cachedBackendUrl;
  }

  // 1. Try Primary Registry
  try {
    const res = await fetch(PRIMARY_REGISTRY, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(3500) });
    if (res.ok) {
      const data = await res.json();
      if (data?.data?.url) {
        cachedBackendUrl = data.data.url.replace(/\/+$/, '');
        lastFetchTime = now;
        return cachedBackendUrl;
      }
    }
  } catch (err) {
    console.warn('Primary registry fetch failed:', err.message);
  }

  // 2. Try Backup Registry
  try {
    const res = await fetch(BACKUP_REGISTRY, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(3500) });
    if (res.ok) {
      const data = await res.json();
      if (data?.data?.url) {
        cachedBackendUrl = data.data.url.replace(/\/+$/, '');
        lastFetchTime = now;
        return cachedBackendUrl;
      }
    }
  } catch (err) {
    console.warn('Backup registry fetch failed:', err.message);
  }

  // 3. Fallback to envUrl if available
  return envUrl ? envUrl.replace(/\/+$/, '') : '';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=30');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = await getLiveBackendUrl();
  if (!url) {
    return res.status(503).json({
      online: false,
      error: 'Laptop server is currently offline. Please run START_CINEMA_FOR_MOM.bat on your laptop.'
    });
  }

  return res.status(200).json({
    online: true,
    url: url
  });
}
