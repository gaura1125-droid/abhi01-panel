// Read-only probe of license.db: find where the APK connection key lives.
const Database = require('better-sqlite3');
const db = new Database('license-system/data/license.db', { readonly: true });
const KEY = '7d0bc33742080fc4546d405946eb9a90dad0d8917b15f8a9';

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('tables:', tables.map(t => t.name).join(', '));

for (const t of tables) {
  let cols, rows;
  try {
    cols = db.prepare('PRAGMA table_info(' + t.name + ')').all().map(c => c.name);
    rows = db.prepare('SELECT * FROM ' + t.name + ' LIMIT 500').all();
  } catch (e) { continue; }
  const hits = rows.filter(r => JSON.stringify(r).toLowerCase().includes('7d0bc3374208'));
  if (hits.length) {
    console.log('=== TABLE ' + t.name + ' | cols: ' + cols.join(', '));
    hits.forEach(h => console.log(JSON.stringify(h, null, 1)));
  } else {
    console.log('- ' + t.name + ' (' + rows.length + ' rows) cols: ' + cols.join(','));
  }
}
db.close();
