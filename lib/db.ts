import Database from 'better-sqlite3';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

// Lazy initialization of SQLite database.
let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (db) return db;
  const dbPath = process.env.DATABASE_PATH || './data/database.sqlite';
  const dir = dbPath.includes('/') ? dbPath.substring(0, dbPath.lastIndexOf('/')) : '.';
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  db = new Database(dbPath);
  // Create table if not exists.
  db.exec(`CREATE TABLE IF NOT EXISTS prompts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS system_prompts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  return db;
}

export function savePrompt(text: string) {
  const database = getDb();
  const stmt = database.prepare('INSERT INTO prompts (text) VALUES (?)');
  stmt.run(text);
}

export function getPrompts(): { id: number; text: string; created_at: string }[] {
  const database = getDb();
  const stmt = database.prepare('SELECT id, text, created_at FROM prompts ORDER BY created_at DESC');
  return stmt.all() as any;
}

export function deletePrompt(id: number) {
  const database = getDb();
  const stmt = database.prepare('DELETE FROM prompts WHERE id = ?');
  stmt.run(id);
}

export function saveSystemPrompt(name: string, text: string) {
  const database = getDb();
  const stmt = database.prepare('INSERT INTO system_prompts (name, text) VALUES (?, ?)');
  stmt.run(name, text);
}

export function getSystemPrompts(): { id: number; name: string; text: string; created_at: string }[] {
  const database = getDb();
  const stmt = database.prepare('SELECT id, name, text, created_at FROM system_prompts ORDER BY created_at DESC');
  return stmt.all() as any;
}

export function getSystemPromptById(id: number): { id: number; name: string; text: string; created_at: string } | null {
  const database = getDb();
  const stmt = database.prepare('SELECT id, name, text, created_at FROM system_prompts WHERE id = ?');
  return (stmt.get(id) as any) ?? null;
}

export function deleteSystemPrompt(id: number) {
  const database = getDb();
  const stmt = database.prepare('DELETE FROM system_prompts WHERE id = ?');
  stmt.run(id);
}
