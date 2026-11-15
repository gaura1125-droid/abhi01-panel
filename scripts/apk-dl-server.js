// Single-purpose APK download server for phone installs.
// Serves one file on every GET/HEAD so the link survives panel auth gates.
// Binds 0.0.0.0 so the same link works over LAN and behind a quick tunnel.
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.APK_DL_PORT || 3100);
const APK = process.env.APK_DL_FILE ||
  path.join(__dirname, '..', 'factory', 'apk_builder', 'builds', 'ABHI0.1_test.apk');

if (!fs.existsSync(APK)) {
  console.error('[apk-dl] missing file: ' + APK);
  process.exit(1);
}
const SIZE = fs.statSync(APK).size;

const server = http.createServer((req, res) => {
  if (req.url === '/ping' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, service: 'apk-dl', size: SIZE }));
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Allow': 'GET, HEAD' });
    res.end();
    return;
  }
  // Range support: Chrome/Android resume large downloads over flaky tunnels.
  const range = req.headers.range;
  const m = range && /^bytes=(\d*)-(\d*)$/.exec(range);
  if (m && (m[1] !== '' || m[2] !== '')) {
    let start = m[1] === '' ? SIZE - Number(m[2]) : Number(m[1]);
    let end = m[1] !== '' && m[2] !== '' ? Number(m[2]) : SIZE - 1;
    if (isNaN(start) || start < 0 || start >= SIZE || end >= SIZE || start > end) {
      res.writeHead(416, { 'Content-Range': `bytes */${SIZE}` });
      res.end();
      return;
    }
    const len = end - start + 1;
    res.writeHead(206, {
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Length': len,
      'Content-Range': `bytes ${start}-${end}/${SIZE}`,
      'Content-Disposition': 'attachment; filename="ABHI0.1_test.apk"',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store'
    });
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(APK, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, {
    'Content-Type': 'application/vnd.android.package-archive',
    'Content-Length': SIZE,
    'Content-Disposition': 'attachment; filename="ABHI0.1_test.apk"',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-store'
  });
  if (req.method === 'HEAD') { res.end(); return; }
  fs.createReadStream(APK).pipe(res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[apk-dl] serving ${APK} (${SIZE} bytes) on :${PORT}`);
});
server.on('error', (e) => { console.error('[apk-dl] ' + e.message); process.exit(1); });
