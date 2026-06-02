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

type WorkflowSegmentStatus = 'todo' | 'voice' | 'image' | 'video' | 'done';

interface WorkflowRow {
  created_at: string;
  id: number;
  title: string;
  updated_at: string;
}

interface WorkflowSegmentRow {
  created_at: string;
  id: number;
  image_prompt: string;
  image_url: string | null;
  segment_order: number;
  status: WorkflowSegmentStatus;
  text: string;
  updated_at: string;
  video_prompt: string;
  video_url: string | null;
  voice_url: string | null;
  workflow_id: number;
}

export interface StoredStyleDnaProfile {
  created_at: string;
  id: number;
  name: string;
  profile: StyleDnaProfile;
}

export interface WorkflowSegmentInput {
  image_prompt?: string | null;
  image_url?: string | null;
  order: number;
  text?: string | null;
  video_prompt?: string | null;
  video_url?: string | null;
  voice_url?: string | null;
}

export interface StoredWorkflowSegment {
  created_at: string;
  id: number;
  image_prompt: string;
  image_url: string | null;
  order: number;
  status: WorkflowSegmentStatus;
  text: string;
  updated_at: string;
  video_prompt: string;
  video_url: string | null;
  voice_url: string | null;
  workflow_id: number;
}

export interface StoredWorkflow {
  created_at: string;
  id: number;
  segments: StoredWorkflowSegment[];
  title: string;
  updated_at: string;
}

export interface WorkflowSegmentUpdate {
  image_prompt?: string;
  image_url?: string | null;
  status?: WorkflowSegmentStatus;
  text?: string;
  video_prompt?: string;
  video_url?: string | null;
  voice_url?: string | null;
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
  db.exec(`CREATE TABLE IF NOT EXISTS workflows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS workflow_segments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id INTEGER NOT NULL,
    segment_order INTEGER NOT NULL,
    text TEXT NOT NULL DEFAULT '',
    image_prompt TEXT NOT NULL DEFAULT '',
    image_url TEXT,
    video_prompt TEXT NOT NULL DEFAULT '',
    video_url TEXT,
    voice_url TEXT,
    status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'voice', 'image', 'video', 'done')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
  )`);
  db.exec('CREATE INDEX IF NOT EXISTS idx_workflow_segments_workflow_order ON workflow_segments (workflow_id, segment_order, id)');
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

function mapWorkflowSegmentRow(row: WorkflowSegmentRow): StoredWorkflowSegment {
  return {
    id: row.id,
    workflow_id: row.workflow_id,
    order: row.segment_order,
    text: row.text,
    image_prompt: row.image_prompt,
    image_url: row.image_url,
    video_prompt: row.video_prompt,
    video_url: row.video_url,
    voice_url: row.voice_url,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapWorkflowRows(workflowRows: WorkflowRow[], segmentRows: WorkflowSegmentRow[]): StoredWorkflow[] {
  const segmentsByWorkflow = new Map<number, StoredWorkflowSegment[]>();

  segmentRows.forEach((row) => {
    const segments = segmentsByWorkflow.get(row.workflow_id) ?? [];
    segments.push(mapWorkflowSegmentRow(row));
    segmentsByWorkflow.set(row.workflow_id, segments);
  });

  return workflowRows.map((row) => ({
    id: row.id,
    title: row.title,
    created_at: row.created_at,
    updated_at: row.updated_at,
    segments: segmentsByWorkflow.get(row.id) ?? [],
  }));
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

export function createWorkflow(title: string, segments: WorkflowSegmentInput[]): StoredWorkflow | null {
  const database = getDb();
  const normalizedTitle = title.trim();
  const normalizedSegments = segments
    .map((segment, index) => ({
      order: Number.isFinite(Number(segment.order)) ? Number(segment.order) : index + 1,
      text: String(segment.text ?? '').trim(),
      image_prompt: String(segment.image_prompt ?? '').trim(),
      image_url: segment.image_url?.trim() || null,
      video_prompt: String(segment.video_prompt ?? '').trim(),
      video_url: segment.video_url?.trim() || null,
      voice_url: segment.voice_url?.trim() || null,
    }))
    .filter((segment) => segment.text || segment.image_prompt || segment.video_prompt);

  const create = database.transaction(() => {
    const workflowResult = database
      .prepare('INSERT INTO workflows (title) VALUES (?)')
      .run(normalizedTitle);
    const workflowId = Number(workflowResult.lastInsertRowid);
    const insertSegment = database.prepare(`
      INSERT INTO workflow_segments (
        workflow_id,
        segment_order,
        text,
        image_prompt,
        image_url,
        video_prompt,
        video_url,
        voice_url
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    normalizedSegments.forEach((segment) => {
      insertSegment.run(
        workflowId,
        segment.order,
        segment.text,
        segment.image_prompt,
        segment.image_url,
        segment.video_prompt,
        segment.video_url,
        segment.voice_url,
      );
    });

    return workflowId;
  });

  const workflowId = create();
  return getWorkflowById(workflowId);
}

export function getWorkflows(): StoredWorkflow[] {
  const database = getDb();
  const workflowRows = database
    .prepare('SELECT id, title, created_at, updated_at FROM workflows ORDER BY updated_at DESC, id DESC')
    .all() as WorkflowRow[];
  const segmentRows = database
    .prepare(`
      SELECT
        id,
        workflow_id,
        segment_order,
        text,
        image_prompt,
        image_url,
        video_prompt,
        video_url,
        voice_url,
        status,
        created_at,
        updated_at
      FROM workflow_segments
      ORDER BY workflow_id, segment_order, id
    `)
    .all() as WorkflowSegmentRow[];

  return mapWorkflowRows(workflowRows, segmentRows);
}

export function getWorkflowById(id: number): StoredWorkflow | null {
  const database = getDb();
  const workflowRow = database
    .prepare('SELECT id, title, created_at, updated_at FROM workflows WHERE id = ?')
    .get(id) as WorkflowRow | undefined;

  if (!workflowRow) {
    return null;
  }

  const segmentRows = database
    .prepare(`
      SELECT
        id,
        workflow_id,
        segment_order,
        text,
        image_prompt,
        image_url,
        video_prompt,
        video_url,
        voice_url,
        status,
        created_at,
        updated_at
      FROM workflow_segments
      WHERE workflow_id = ?
      ORDER BY segment_order, id
    `)
    .all(id) as WorkflowSegmentRow[];

  return mapWorkflowRows([workflowRow], segmentRows)[0] ?? null;
}

export function deleteWorkflow(id: number): StoredWorkflow | null {
  const database = getDb();
  const workflow = getWorkflowById(id);

  if (!workflow) {
    return null;
  }

  const remove = database.transaction(() => {
    database.prepare('DELETE FROM workflow_segments WHERE workflow_id = ?').run(id);
    database.prepare('DELETE FROM workflows WHERE id = ?').run(id);
  });

  remove();
  return workflow;
}

export function getWorkflowSegmentById(id: number): StoredWorkflowSegment | null {
  const database = getDb();
  const row = database
    .prepare(`
      SELECT
        id,
        workflow_id,
        segment_order,
        text,
        image_prompt,
        image_url,
        video_prompt,
        video_url,
        voice_url,
        status,
        created_at,
        updated_at
      FROM workflow_segments
      WHERE id = ?
    `)
    .get(id) as WorkflowSegmentRow | undefined;

  return row ? mapWorkflowSegmentRow(row) : null;
}

export function updateWorkflowSegment(id: number, updates: WorkflowSegmentUpdate): StoredWorkflowSegment | null {
  const database = getDb();
  const allowedStatuses: WorkflowSegmentStatus[] = ['todo', 'voice', 'image', 'video', 'done'];
  const current = getWorkflowSegmentById(id);

  if (!current) {
    return null;
  }

  const next = {
    status: updates.status && allowedStatuses.includes(updates.status) ? updates.status : current.status,
    text: updates.text ?? current.text,
    image_prompt: updates.image_prompt ?? current.image_prompt,
    image_url: updates.image_url === undefined ? current.image_url : updates.image_url,
    video_prompt: updates.video_prompt ?? current.video_prompt,
    video_url: updates.video_url === undefined ? current.video_url : updates.video_url,
    voice_url: updates.voice_url === undefined ? current.voice_url : updates.voice_url,
  };

  database.prepare(`
    UPDATE workflow_segments
    SET
      status = ?,
      text = ?,
      image_prompt = ?,
      image_url = ?,
      video_prompt = ?,
      video_url = ?,
      voice_url = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    next.status,
    next.text,
    next.image_prompt,
    next.image_url,
    next.video_prompt,
    next.video_url,
    next.voice_url,
    id,
  );

  database
    .prepare('UPDATE workflows SET updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(current.workflow_id);

  return getWorkflowSegmentById(id);
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
