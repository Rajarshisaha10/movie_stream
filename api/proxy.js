// Vercel Serverless Proxy to route /api/* and /stream/* to laptop backend

export default async function handler(req, res) {
  // Read backend URL from Vercel environment variable or query param / header
  const backendUrl = process.env.BACKEND_URL || req.headers['x-backend-url'] || '';

  if (!backendUrl) {
    return res.status(503).json({
      error: 'BACKEND_URL is not configured in Vercel environment variables.',
      message: 'Please set BACKEND_URL in your Vercel Project Settings to your laptop\'s tunnel URL (e.g. https://xxxx.trycloudflare.com)'
    });
  }

  // Construct target URL
  const cleanBackend = backendUrl.replace(/\/+$/, '');
  const targetUrl = `${cleanBackend}${req.url}`;

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
