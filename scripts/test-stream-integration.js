// Integration test for the repaired streaming controls.
//
// Exercises the REAL running backend over HTTP + WebSocket with a simulated
// APK client, verifying frontend-to-backend behaviour end to end:
//   1. WebP (scread) frame path: base64 WebP in -> /screen/live/frame returns
//      image/webp bytes out, decoded from the RIFF/WEBP magic.
//   2. H.264 binary path (MyPacket.Stream) regression: config + video packets
//      are validated and forwarded raw to a /stream viewer.
//   3. Quality endpoint: valid values persist and surface on /screen/live/status
//      and are consumed by /screen/live/start; invalid values return errors.
//   4. Screen Reader (scread) command reaches the connected APK socket.
//
// Run: node scripts/test-stream-integration.js   (server must be running)
// Exits non-zero on any failure.

const WebSocket = require('ws');
const http = require('http');

const BACKEND = 'http://127.0.0.1:22222';
const DASH = 'http://127.0.0.1:3000';

let passed = 0, failed = 0;
function ok(name, cond, extra) {
  if (cond) { passed++; console.log('  PASS  ' + name); }
  else { failed++; console.log('  FAIL  ' + name + (extra ? ' :: ' + extra : '')); }
}

function req(method, url, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = body ? JSON.stringify(body) : null;
    const r = http.request({
      hostname: u.hostname, port: u.port, path: u.pathname + u.search, method,
      headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        let json = null;
        try { json = JSON.parse(buf.toString('utf8')); } catch (e) {}
        resolve({ status: res.statusCode, headers: res.headers, buf, body: buf.toString('utf8'), json });
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

// MyPacket.Stream packet (28-byte BE header, see MyPacket.java / device-store)
function streamPacket(type, sessionId, seq, flags, payload) {
  const h = Buffer.alloc(28);
  h.writeUInt16BE(0x4853, 0); h.writeUInt8(1, 2); h.writeUInt8(type, 3);
  h.writeUInt32BE(sessionId, 4); h.writeUInt32BE(seq, 8);
  h.writeBigUInt64BE(BigInt(seq * 33), 12);
  h.writeUInt32BE(flags, 20); h.writeUInt32BE(payload.length, 24);
  return Buffer.concat([h, payload]);
}

// Minimal buffer that sniffs as WebP (RIFF....WEBP) for decodeScreenshotImage.
function webpBytes(n) {
  const b = Buffer.alloc(n);
  b.write('RIFF', 0, 'ascii'); b.writeUInt32LE(n - 8, 4);
  b.write('WEBP', 8, 'ascii');
  for (let i = 12; i < n; i++) b[i] = (i * 7) & 0xff;
  return b;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log('\n=== streaming integration tests ===');

  // ---- APK socket ----
  const apk = new WebSocket(BACKEND + '/');
  const apkReceived = [];
  await new Promise((res, rej) => { apk.on('open', res); apk.on('error', rej); });
  apk.on('message', d => { try { apkReceived.push(JSON.parse(d.toString())); } catch (e) {} });
  apk.send(JSON.stringify({ idf: 'test', pid: 'itest', itype: 'Slr_client', subc: 'join' }));
  await sleep(150);

  // ---- viewer on /stream ----
  const viewer = new WebSocket(DASH + '/stream');
  const viewerBin = [];
  const viewerTxt = [];
  viewer.binaryType = 'arraybuffer';
  await new Promise((res, rej) => { viewer.on('open', res); viewer.on('error', rej); });
  viewer.on('message', (d, isBin) => { if (isBin) viewerBin.push(Buffer.from(d)); else viewerTxt.push(d.toString()); });
  await sleep(150);

  // 1. WebP (scread) frame path ------------------------------------------
  console.log('\n[1] WebP / scread frame path');
  const wp = webpBytes(4096);
  const b64 = wp.toString('base64');
  apk.send(JSON.stringify({ idf: 'test', pid: 'itest', itype: 'Slr_client', subc: 'msg',
    msg: JSON.stringify({ type: 'scread', img: b64, frmt: 'w', skly: '0', wmob: '720', hmob: '1280' }) }));
  await sleep(300);
  const frame = await req('GET', DASH + '/api/screen/live/frame');
  ok('frame endpoint returns 200', frame.status === 200, 'got ' + frame.status);
  ok('frame content-type is image/webp', (frame.headers['content-type'] || '') === 'image/webp', frame.headers['content-type']);
  // A live device may legitimately overwrite the synthetic frame with its own
  // scread WebP, so validate the returned bytes sniff as WebP rather than
  // requiring byte-exact equality with what the simulated APK sent.
  const isWebp = frame.buf && frame.buf.length > 12 &&
    frame.buf.toString('ascii', 0, 4) === 'RIFF' && frame.buf.toString('ascii', 8, 12) === 'WEBP';
  ok('returned frame sniffs as valid WebP (bytes > 12, RIFF/WEBP magic)', isWebp,
     'len=' + (frame.buf ? frame.buf.length : 0));

  // 2. H.264 binary path regression --------------------------------------
  console.log('\n[2] H.264 binary path (MyPacket.Stream)');
  const sps = Buffer.from([0,0,0,1,0x67,0x42,0xc0,0x1e,0,0,0,1,0x68,0xce,0x3c,0x80]);
  const idr = Buffer.from([0,0,0,1,0x65,0x88,0x84,0x21]);
  apk.send(streamPacket(2, 9, 0, 0, sps));   // CODEC_CONFIG
  apk.send(streamPacket(1, 9, 1, 1, idr));   // VIDEO + keyframe flag
  await sleep(300);
  // A live device streams its own frames to every viewer, so don't assert an
  // exact count. Instead assert OUR synthetic packets (sessionId 9) were
  // validated and forwarded raw to the viewer.
  const mine = viewerBin.filter(b => b.length >= 28 && b.readUInt16BE(0) === 0x4853 && b.readUInt32BE(4) === 9);
  ok('viewer received our 2 synthetic packets (sessionId 9)', mine.length === 2, 'got ' + mine.length);
  ok('synthetic packets carry magic 0x4853 + CONFIG/VIDEO types',
     mine.length === 2 && mine[0].readUInt8(3) === 2 && mine[1].readUInt8(3) === 1);

  // 3. Quality endpoint ---------------------------------------------------
  console.log('\n[3] Quality selector backend');
  const qv = await req('POST', DASH + '/api/screen/quality', { quality: 45 });
  ok('valid quality -> success + bitrate', qv.json && qv.json.success === true && qv.json.bitrate === 4500000, JSON.stringify(qv.json));
  const st = await req('GET', DASH + '/api/screen/live/status');
  ok('live/status echoes persisted quality=45', st.json && st.json.quality === 45, JSON.stringify(st.json));
  const ls = await req('POST', DASH + '/api/screen/live/start', {});
  ok('live/start defaults to persisted quality=45', ls.json && ls.json.quality === 45, JSON.stringify(ls.json));
  const qhi = await req('POST', DASH + '/api/screen/quality', { quality: 999 });
  ok('out-of-range quality -> 400 + error', qhi.status === 400 && /out of range/.test(qhi.json.error), qhi.body);
  const qbad = await req('POST', DASH + '/api/screen/quality', { quality: 'abc' });
  ok('non-integer quality -> 400 + error', qbad.status === 400 && /integer/.test(qbad.json.error), qbad.body);

  // 4. Screen Reader command reaches APK ---------------------------------
  console.log('\n[4] Screen Reader (scread) command');
  const before = apkReceived.length;
  const sr = await req('POST', DASH + '/api/apk/screenread', { cas: '1', skidf: 'itest' });
  ok('screenread endpoint success', sr.json && sr.json.success === true, sr.body);
  await sleep(200);
  const gotScread = apkReceived.slice(before).some(m => m.msg === 'scread' || (m.pdata && /scread/.test(m.pdata)));
  ok('APK socket received scread command', gotScread, JSON.stringify(apkReceived.slice(before)));

  // cleanup
  try { viewer.close(); } catch (e) {}
  try { apk.close(); } catch (e) {}

  console.log('\n=== result: ' + passed + ' passed, ' + failed + ' failed ===');
  process.exit(failed ? 1 : 0);
}

main().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
