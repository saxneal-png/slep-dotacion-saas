const fs = require('fs');
const initSqlJs = require('sql.js');

async function extractSqliteFromBlob() {
  const filePath = 'C:\\Users\\DionicioFelipeFlores\\AppData\\Roaming\\slep-valle-diguillin-dotacion\\IndexedDB\\file__0.indexeddb.blob\\1\\10\\1082';
  const raw = fs.readFileSync(filePath);
  
  // Find where "SQLite format 3" starts
  const sqliteHeader = Buffer.from('SQLite format 3\0');
  const index = raw.indexOf(sqliteHeader);
  console.log('SQLite header index:', index);

  if (index === -1) {
    console.error('Could not find SQLite header');
    return;
  }

  const sqliteBytes = raw.subarray(index);
  console.log('Clean SQLite buffer size:', sqliteBytes.length);

  // Save clean sqlite file for easy reading
  fs.writeFileSync('database/extracted_local_database.sqlite', sqliteBytes);
  console.log('Saved to database/extracted_local_database.sqlite');

  const SQL = await initSqlJs();
  const db = new SQL.Database(sqliteBytes);

  // List all tables
  const tablesRes = db.exec("SELECT name FROM sqlite_master WHERE type='table';");
  const tables = tablesRes[0]?.values.map(v => v[0]) || [];
  console.log('\n--- Tablas en la base de datos local SQLite ---');
  for (const t of tables) {
    const countRes = db.exec(`SELECT count(*) FROM "${t}";`);
    const count = countRes[0]?.values[0][0];
    console.log(`- ${t}: ${count} registros`);
  }
}

extractSqliteFromBlob().catch(console.error);
