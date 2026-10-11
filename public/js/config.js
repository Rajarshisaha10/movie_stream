// Dynamic Backend Configuration for Vercel & Multi-Host Deployments

(function() {
  // Check if server URL was passed via URL parameter e.g. ?server=https://xxxx.trycloudflare.com
  const urlParams = new URLSearchParams(window.location.search);
  const paramServer = urlParams.get('server') || urlParams.get('backend');

  if (paramServer) {
    const clean = paramServer.replace(/\/+$/, '');
    localStorage.setItem('cinema_server_url', clean);
    console.log('[Cinema Config] Saved server URL to localStorage:', clean);
  }

  // Get configured server URL (empty string means same-origin relative path, e.g. via Vercel proxy or local server)
  window.CINEMA_SERVER_URL = localStorage.getItem('cinema_server_url') || '';

  // Helper to resolve API and Stream endpoints
  window.resolveApiUrl = function(endpoint) {
    if (!endpoint.startsWith('/')) endpoint = '/' + endpoint;
    return window.CINEMA_SERVER_URL ? `${window.CINEMA_SERVER_URL}${endpoint}` : endpoint;
  };
})();
