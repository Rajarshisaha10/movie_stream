// Dynamic Backend Configuration & Auto-Discovery for Vercel & Multi-Host Deployments

(function() {
  // 1. Check if server URL was passed explicitly via URL parameter (e.g. ?backend=https://xxxx.trycloudflare.com)
  const urlParams = new URLSearchParams(window.location.search);
  const paramServer = urlParams.get('server') || urlParams.get('backend');

  if (paramServer) {
    const clean = paramServer.replace(/\/+$/, '');
    localStorage.setItem('cinema_server_url', clean);
    console.log('[Cinema Config] Saved server URL from parameter:', clean);
  }

  // Get locally cached server URL
  window.CINEMA_SERVER_URL = localStorage.getItem('cinema_server_url') || '';

  // 2. Auto-Discovery: Asynchronously fetch live backend URL from Vercel discovery endpoint
  window.initAutoDiscovery = async function() {
    try {
      const res = await fetch('/api/backend-url', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.online && data.url) {
          const cleanUrl = data.url.replace(/\/+$/, '');
          window.CINEMA_SERVER_URL = cleanUrl;
          localStorage.setItem('cinema_server_url', cleanUrl);
          console.log('[Cinema Config] Auto-discovered live backend:', cleanUrl);
          return cleanUrl;
        }
      }
    } catch (err) {
      console.warn('[Cinema Config] Auto-discovery endpoint offline or same-origin:', err.message);
    }
    return window.CINEMA_SERVER_URL || '';
  };

  // Kick off auto-discovery immediately in the background
  window.initAutoDiscovery();

  // 3. Helper to resolve API and Stream endpoints
  window.resolveApiUrl = function(endpoint) {
    if (!endpoint.startsWith('/')) endpoint = '/' + endpoint;
    return window.CINEMA_SERVER_URL ? `${window.CINEMA_SERVER_URL}${endpoint}` : endpoint;
  };

  // 4. Shared authenticated fetch helper
  window.getAuthToken = function() {
    return localStorage.getItem('cinema_auth_token') || '';
  };

  window.authFetch = function(endpoint, options = {}) {
    const url = window.resolveApiUrl(endpoint);
    const token = window.getAuthToken();
    const headers = { ...(options.headers || {}) };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['x-auth-token'] = token;
    }
    options.headers = headers;
    options.credentials = 'include';
    return fetch(url, options);
  };
})();
