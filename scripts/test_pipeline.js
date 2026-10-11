// Integration Test Script for Movie Stream Server

async function runTests() {
  const baseUrl = 'http://127.0.0.1:3000';
  console.log(`\n🧪 Running Automated Pipeline Tests on ${baseUrl}...\n`);

  let sessionCookie = '';

  // 1. Test Auth Login
  console.log('1️⃣ Testing Authentication: POST /api/auth/login');
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'mom123' })
  });

  const loginData = await loginRes.json();
  if (!loginRes.ok || !loginData.success) {
    throw new Error(`Login failed: ${JSON.stringify(loginData)}`);
  }

  const rawCookie = loginRes.headers.get('set-cookie');
  if (rawCookie) {
    sessionCookie = rawCookie.split(';')[0];
  }
  console.log(`   ✅ Login successful! Session cookie received: ${sessionCookie.substring(0, 20)}...`);

  const authHeaders = {
    'Cookie': sessionCookie
  };

  // 2. Test Get Movies Catalog
  console.log('\n2️⃣ Testing Movies Catalog: GET /api/movies');
  const moviesRes = await fetch(`${baseUrl}/api/movies`, { headers: authHeaders });
  const moviesData = await moviesRes.json();

  if (!moviesRes.ok || !moviesData.movies || moviesData.movies.length === 0) {
    throw new Error(`Failed to list movies: ${JSON.stringify(moviesData)}`);
  }

  const movie = moviesData.movies[0];
  console.log(`   ✅ Found movie: "${movie.title}" (ID: ${movie.id})`);
  console.log(`   Resolution: ${movie.resolution}, Duration: ${movie.durationFormatted}, Codec: ${movie.codec}`);
  console.log(`   Subtitles detected: ${movie.subtitles.length}`);

  // 3. Test Thumbnail Endpoint
  console.log('\n3️⃣ Testing Thumbnail: GET ' + movie.thumbnailUrl);
  const thumbRes = await fetch(`${baseUrl}${movie.thumbnailUrl}`, { headers: authHeaders });
  if (!thumbRes.ok || thumbRes.headers.get('content-type') !== 'image/jpeg') {
    throw new Error(`Thumbnail failed with status ${thumbRes.status}`);
  }
  const thumbBuffer = await thumbRes.arrayBuffer();
  console.log(`   ✅ Thumbnail fetched successfully! Size: ${thumbBuffer.byteLength} bytes, Type: image/jpeg`);

  // 4. Test Subtitle Endpoint (.srt to WebVTT conversion)
  if (movie.subtitles.length > 0) {
    const sub = movie.subtitles[0];
    console.log(`\n4️⃣ Testing Subtitle: GET /stream/subtitles/${movie.id}/${sub.id}`);
    const subRes = await fetch(`${baseUrl}/stream/subtitles/${movie.id}/${sub.id}`, { headers: authHeaders });
    const subText = await subRes.text();
    if (!subRes.ok || !subText.startsWith('WEBVTT')) {
      throw new Error(`Subtitle conversion failed: ${subText.substring(0, 100)}`);
    }
    console.log(`   ✅ Subtitle converted to valid WebVTT! Preview:\n   ${subText.split('\n').slice(0, 4).join('\n   ')}`);
  }

  // 5. Test Direct Play HTTP Range Request (206 Partial Content)
  console.log(`\n5️⃣ Testing HTTP Range Request: GET /stream/direct/${movie.id} with Range: bytes=0-1023`);
  const rangeRes = await fetch(`${baseUrl}/stream/direct/${movie.id}`, {
    headers: { ...authHeaders, 'Range': 'bytes=0-1023' }
  });

  if (rangeRes.status !== 206) {
    throw new Error(`Expected HTTP 206 Partial Content, received: ${rangeRes.status}`);
  }
  const contentRange = rangeRes.headers.get('content-range');
  const acceptRanges = rangeRes.headers.get('accept-ranges');
  console.log(`   ✅ HTTP 206 Partial Content verified!`);
  console.log(`   Content-Range: ${contentRange}, Accept-Ranges: ${acceptRanges}`);

  // 6. Test HLS Master Playlist
  console.log(`\n6️⃣ Testing HLS Master Playlist: GET /stream/hls/${movie.id}/master.m3u8`);
  const masterRes = await fetch(`${baseUrl}/stream/hls/${movie.id}/master.m3u8`, { headers: authHeaders });
  const masterText = await masterRes.text();
  if (!masterRes.ok || !masterText.includes('#EXT-X-STREAM-INF')) {
    throw new Error(`Master playlist failed: ${masterText}`);
  }
  console.log(`   ✅ Master Playlist valid! Variants:\n   ${masterText.trim().replace(/\n/g, '\n   ')}`);

  // 7. Test HLS Transcoding & Variant Playlist (720p)
  console.log(`\n7️⃣ Testing HLS 720p Transcoding: GET /stream/hls/${movie.id}/720p/index.m3u8`);
  const variantRes = await fetch(`${baseUrl}/stream/hls/${movie.id}/720p/index.m3u8`, { headers: authHeaders });
  const variantText = await variantRes.text();
  if (!variantRes.ok || !variantText.includes('#EXTM3U')) {
    throw new Error(`Variant playlist failed: ${variantText}`);
  }
  console.log(`   ✅ 720p HLS Playlist generated! First segments:\n   ${variantText.split('\n').slice(0, 8).join('\n   ')}`);

  // 8. Test Watch Progress Persistence
  console.log(`\n8️⃣ Testing Watch Progress Save: POST /api/progress/${movie.id}`);
  const saveProgressRes = await fetch(`${baseUrl}/api/progress/${movie.id}`, {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentTime: 18, duration: 30 })
  });
  const saveProgressData = await saveProgressRes.json();
  if (!saveProgressRes.ok || !saveProgressData.progress) {
    throw new Error(`Progress save failed: ${JSON.stringify(saveProgressData)}`);
  }
  console.log(`   ✅ Progress saved: at ${saveProgressData.progress.currentTime}s (${saveProgressData.progress.percentage}%)`);

  console.log('\n🎉 ALL PIPELINE TESTS PASSED SUCCESSFULLY! 🚀\n');
}

runTests().catch((err) => {
  console.error('\n❌ Test pipeline failed:', err.message);
  process.exit(1);
});
