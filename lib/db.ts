import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { normalizeStyleDnaProfile, type StyleDnaProfile } from './style-dna';

interface StyleDnaProfileRow {
  created_at: string;
  id: number;
  name: string;
  profile_json: string;
}

interface ThreadsAuthRow {
  access_token: string;
  created_at: string;
  expires_at: string | null;
  updated_at: string;
  user_id: string | null;
}

export interface StoredStyleDnaProfile {
  created_at: string;
  id: number;
  name: string;
  profile: StyleDnaProfile;
}

export interface StoredThreadsAuth {
  access_token: string;
  created_at: string;
  expires_at: string | null;
  updated_at: string;
  user_id: string | null;
}

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
  db.exec(`CREATE TABLE IF NOT EXISTS style_dna_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    profile_json TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS threads_auth (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    access_token TEXT NOT NULL,
    user_id TEXT,
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  return db;
}

function mapStyleDnaProfileRow(row: StyleDnaProfileRow): StoredStyleDnaProfile {
  let profile: StyleDnaProfile;

  try {
    profile = normalizeStyleDnaProfile(JSON.parse(row.profile_json));
  } catch {
    profile = normalizeStyleDnaProfile({});
  }

  return {
    id: row.id,
    name: row.name,
    profile,
    created_at: row.created_at,
  };
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

export function saveStyleDnaProfile(name: string, profile: StyleDnaProfile) {
  const database = getDb();
  const normalizedProfile = normalizeStyleDnaProfile(profile);
  const stmt = database.prepare('INSERT INTO style_dna_profiles (name, profile_json) VALUES (?, ?)');
  const result = stmt.run(name, JSON.stringify(normalizedProfile));
  const id = Number(result.lastInsertRowid);
  return getStyleDnaProfileById(id);
}

export function getStyleDnaProfiles(): StoredStyleDnaProfile[] {
  const database = getDb();
  const stmt = database.prepare('SELECT id, name, profile_json, created_at FROM style_dna_profiles ORDER BY created_at DESC, id DESC');
  const rows = stmt.all() as StyleDnaProfileRow[];
  return rows.map(mapStyleDnaProfileRow);
}

export function getStyleDnaProfileById(id: number): StoredStyleDnaProfile | null {
  const database = getDb();
  const stmt = database.prepare('SELECT id, name, profile_json, created_at FROM style_dna_profiles WHERE id = ?');
  const row = (stmt.get(id) as StyleDnaProfileRow | undefined) ?? null;
  return row ? mapStyleDnaProfileRow(row) : null;
}

export function deleteStyleDnaProfile(id: number) {
  const database = getDb();
  const stmt = database.prepare('DELETE FROM style_dna_profiles WHERE id = ?');
  stmt.run(id);
}

export function getThreadsAuth(): StoredThreadsAuth | null {
  const database = getDb();
  const stmt = database.prepare('SELECT access_token, user_id, expires_at, created_at, updated_at FROM threads_auth WHERE id = 1');
  return (stmt.get() as ThreadsAuthRow | undefined) ?? null;
}

export function saveThreadsAuth(input: {
  accessToken: string;
  expiresAt?: string | null;
  userId?: string | null;
}) {
  const database = getDb();
  const stmt = database.prepare(`
    INSERT INTO threads_auth (id, access_token, user_id, expires_at, created_at, updated_at)
    VALUES (1, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      access_token = excluded.access_token,
      user_id = excluded.user_id,
      expires_at = excluded.expires_at,
      updated_at = CURRENT_TIMESTAMP
  `);
  stmt.run(input.accessToken, input.userId ?? null, input.expiresAt ?? null);
  return getThreadsAuth();
}

export function deleteThreadsAuth() {
  const database = getDb();
  const stmt = database.prepare('DELETE FROM threads_auth WHERE id = 1');
  stmt.run();
}
