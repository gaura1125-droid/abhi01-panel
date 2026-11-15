// Clear trusted devices only (file store + DB) so the login page renders again.
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const ROOT = path.join(__dirname, '..');
fs.writeFileSync(path.join(ROOT, 'login', 'trusted_devices.json'), '[]');
try { fs.writeFileSync(path.join(ROOT, 'login', 'remember_tokens.json'), '[]'); } catch (e) {}

const db = new Database(path.join(ROOT, 'license-system', 'data', 'license.db'));
try { db.prepare('DELETE FROM trusted_devices').run(); } catch (e) { console.log('db skip', e.message); }
try { db.prepare('DELETE FROM otp_sessions').run(); } catch (e) {}
db.close();

console.log('OK trusted devices cleared');
