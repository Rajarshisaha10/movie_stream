// Vercel Serverless Entrypoint

import proxyHandler from './api/proxy.js';

export default function handler(req, res) {
  // If request is for an API or stream route, forward to proxy handler
  if (req.url.startsWith('/api') || req.url.startsWith('/stream')) {
    return proxyHandler(req, res);
  }
  return res.status(200).json({
    status: 'online',
    app: 'Family Cinema Frontend',
    version: '1.0.0'
  });
}
