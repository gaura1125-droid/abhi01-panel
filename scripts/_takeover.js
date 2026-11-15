// Ownership takeover: new credentials + flush previous-owner data.
// Backup must exist before running (backup_* dir next to Armaan_Release).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');

const ROOT = path.join(__dirname, '..');
const NEW_USER = process.env.NEWOBJ_USER || 'olivia';
const NEW_PASS = process.env.NEWOBJ_PASS || 'olivia@Bench2026';

const hash = bcrypt.hashSync(NEW_PASS, 10);

// 1. login/users.json — panel credential store
fs.writeFileSync(path.join(ROOT, 'login', 'users.json'),
  JSON.stringify([{ username: NEW_USER, password: hash }], null, 2));

// 2. license.db — users, tokens, devices, secrets
const db = new Database(path.join(ROOT, 'license-system', 'data', 'license.db'));
const tx = db.transaction(() => {
  const keep = db.prepare('SELECT id FROM users WHERE username = ?').get(NEW_USER);
  if (keep) {
    db.prepare('UPDATE users SET username = ?, password_hash = ?, role = ? WHERE id = ?')
      .run(NEW_USER, hash, 'super_admin', keep.id);
  } else {
    db.prepare("INSERT INTO users (username, password_hash, role, license_status, created_at, created_by, is_active) VALUES (?,?,?,?,datetime('now'),'system',1)")
      .run(NEW_USER, hash, 'super_admin', 'active');
  }
  // previous owner accounts gone (after child rows, FK order)
  // their data gone
  for (const t of ['trusted_devices', 'otp_sessions', 'login_logs', 'user_devices',
                   'devices', 'client_tokens', 'user_firebase_configs']) {
    try { db.prepare(`DELETE FROM ${t}`).run(); } catch (e) { console.log('skip', t, e.message); }
  }
  db.prepare('DELETE FROM users WHERE username != ?').run(NEW_USER);
  // super-admin token regenerated, claimed by our chat id
  const tok = crypto.randomBytes(32).toString('hex');
  const row = db.prepare('SELECT id FROM super_admin LIMIT 1').get();
  if (row) db.prepare('UPDATE super_admin SET secret_token = ?, chat_id = ? WHERE id = ?')
    .run(tok, '7612610042', row.id);
  else db.prepare('INSERT INTO super_admin (secret_token, chat_id) VALUES (?,?)').run(tok, '7612610042');
  return tok;
});
const superToken = tx();
db.close();

// 3. login sidecars — trusted browsers + remember tokens wiped
fs.writeFileSync(path.join(ROOT, 'login', 'trusted_devices.json'), '[]');
fs.writeFileSync(path.join(ROOT, 'login', 'remember_tokens.json'), '[]');

// 4. session secret rotated — every old cookie dies
fs.writeFileSync(path.join(ROOT, 'storage', 'session-secret.txt'),
  crypto.randomBytes(48).toString('hex'));

console.log('OK user=' + NEW_USER);
console.log('OK super_admin.token=' + superToken);
