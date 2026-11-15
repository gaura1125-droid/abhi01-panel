// Retarget every public URL in armand.json at the host's public IP.
// Usage: node deploy/configure.js <public-ip>
const fs = require('fs');
const path = require('path');

const ip = process.argv[2];
if (!ip || !/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
  console.error('usage: node deploy/configure.js <public-ip>');
  process.exit(1);
}
const base = 'http://' + ip;
const p = path.join(__dirname, '..', 'armand.json');
const cfg = JSON.parse(fs.readFileSync(p, 'utf8'));

cfg.connection = cfg.connection || {};
cfg.connection.public_url = base + ':3000';
cfg.connection.dashboard_port = 3000;
cfg.connection.apk_port = 22222;

cfg.server = cfg.server || {};
cfg.server.host = '0.0.0.0';
cfg.server.port = 22222;
cfg.server.baseUrl = 'http://127.0.0.1:22222';
cfg.server.publicUrl = base + ':22222';
cfg.server.overlay_base_url = 'http://127.0.0.1:3000';

cfg.client = cfg.client || {};
cfg.client.apiUrl = 'http://127.0.0.1:22222';

fs.writeFileSync(p, JSON.stringify(cfg, null, 2));
console.log('[cfg] panel   -> http://' + ip + ':3000');
console.log('[cfg] apk/ws  -> http://' + ip + ':22222');
console.log('[cfg] apk-dl  -> http://' + ip + ':3100/ABHI0.1_test.apk');
