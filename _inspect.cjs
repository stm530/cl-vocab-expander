const Database = require('better-sqlite3');
const db = new Database('H:/R/Documents/vsc/人工言語語彙拡充器/public/wnjpn.db', { readonly: true });
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log('TABLES:', tables.map(t => t.name).join(', '));
for (const t of tables) {
  const sql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(t.name);
  console.log('--- ' + t.name + ' ---');
  console.log(sql.sql);
  try {
    const c = db.prepare(`SELECT COUNT(*) c FROM "${t.name}"`).get();
    console.log('COUNT = ' + c.c);
  } catch(e) { console.log('COUNT-ERR ' + e.message); }
}
db.close();
