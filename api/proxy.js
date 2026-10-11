import { getLiveBackendUrl } from './backend-url.js';

export default async function handler(req, res) {
  // Read backend URL from query param, header, or auto-discovery registry
  let backendUrl = req.headers['x-backend-url'] || '';
  if (!backendUrl) {
    backendUrl = await getLiveBackendUrl();
  }

  if (!backendUrl) {
    return res.status(503).json({
      error: 'Laptop server is currently offline.',
      message: 'Please run START_CINEMA_FOR_MOM.bat on your laptop to connect.'
    });
  }

  // Extract path: if rewritten via vercel.json with ?path=, use it; otherwise fallback to headers or req.url
  let requestPath = req.url;
  try {
    const urlObj = new URL(req.url, 'http://localhost');
    const paramPath = urlObj.searchParams.get('path');
    if (paramPath) {
      urlObj.searchParams.delete('path');
      const remainingSearch = urlObj.searchParams.toString();
      requestPath = paramPath + (remainingSearch ? (paramPath.includes('?') ? '&' : '?') + remainingSearch : '');
    } else if (req.headers['x-matched-path']) {
      requestPath = req.headers['x-matched-path'];
    }
  } catch (e) {
    requestPath = req.url;
  }

  // Construct target URL
  const cleanBackend = backendUrl.replace(/\/+$/, '');
  const targetUrl = `${cleanBackend}${requestPath.startsWith('/') ? requestPath : '/' + requestPath}`;

  try {
    const fetchOptions = {
      method: req.method,
      headers: { ...req.headers },
      redirect: 'manual'
    };

    // Remove host header to avoid SSL mismatch
    delete fetchOptions.headers.host;
    delete fetchOptions.headers['x-forwarded-host'];

    // If request has a body (e.g. POST /api/auth/login)
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      fetchOptions.body = typeof req.body === 'object' ? JSON.stringify(req.body) : req.body;
      if (!fetchOptions.headers['content-type']) {
        fetchOptions.headers['content-type'] = 'application/json';
      }
    }

    const proxyRes = await fetch(targetUrl, fetchOptions);

    // Forward response status
    res.status(proxyRes.status);

    // Forward response headers
    for (const [key, value] of proxyRes.headers.entries()) {
      // Avoid encoding issues with chunked responses
      if (key.toLowerCase() !== 'content-encoding') {
        res.setHeader(key, value);
      }
    }

    // Stream response body back to browser
    if (proxyRes.body) {
      const reader = proxyRes.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    } else {
      res.end();
    }
  } catch (err) {
    console.error(`Proxy error forwarding to ${targetUrl}:`, err.message);
    res.status(502).json({
      error: 'Cannot connect to home laptop streaming server.',
      details: err.message,
      target: targetUrl
    });
  }
}
