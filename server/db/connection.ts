import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }
  const isCloudRun = Boolean(process.env.K_SERVICE);
  const defaultDbPath = isCloudRun
    ? path.join('/tmp', 'littlesteps.db')
    : path.join(process.cwd(), 'data', 'littlesteps.db');
  const preferredPath = path.resolve(process.env.SQLITE_DB_PATH || defaultDbPath);

  let db: Database.Database;
  try {
    fs.mkdirSync(path.dirname(preferredPath), { recursive: true });
    db = new Database(preferredPath);
  } catch (err) {
    const fallbackPath = path.join('/tmp', 'littlesteps.db');
    if (preferredPath === fallbackPath) {
      throw err;
    }
    fs.mkdirSync(path.dirname(fallbackPath), { recursive: true });
    db = new Database(fallbackPath);
  }

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  dbInstance = db;
  return db;
}
