import Database from 'better-sqlite3';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
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

interface YouTubeConfigRow {
  category_id: string;
  contains_synthetic_media: number;
  created_at: string;
  default_description: string;
  default_tags_json: string;
  id: number;
  name: string;
  privacy_status: YouTubePrivacyStatus;
  self_declared_made_for_kids: number;
  thumbnail_url: string | null;
  title_template: string;
  updated_at: string;
  youtube_profile_id: number | null;
}

interface YouTubeProfileRow {
  access_token_encrypted: string | null;
  channel_id: string | null;
  channel_title: string | null;
  created_at: string;
  google_account_email: string | null;
  google_account_id: string | null;
  id: number;
  name: string;
  refresh_token_encrypted: string | null;
  scope: string | null;
  token_expires_at: string | null;
  token_type: string | null;
  updated_at: string;
}

type YouTubePrivacyStatus = 'private' | 'public' | 'unlisted';
type WorkflowSegmentStatus = 'todo' | 'voice' | 'image' | 'video' | 'done';

interface WorkflowRow {
  created_at: string;
  finalized_url: string | null;
  id: number;
  title: string;
  updated_at: string;
  youtube_config_id: number | null;
  youtube_publish_url: string | null;
  youtube_published_at: string | null;
  youtube_video_id: string | null;
}

interface WorkflowSegmentRow {
  assembled_url: string | null;
  created_at: string;
  id: number;
  image_prompt: string;
  image_url: string | null;
  segment_order: number;
  srt: string | null;
  status: WorkflowSegmentStatus;
  text: string;
  updated_at: string;
  video_no_sound: number;
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
  assembled_url?: string | null;
  image_prompt?: string | null;
  image_url?: string | null;
  order: number;
  srt?: string | null;
  text?: string | null;
  video_no_sound?: boolean | null;
  video_prompt?: string | null;
  video_url?: string | null;
  voice_url?: string | null;
}

export interface StoredWorkflowSegment {
  assembled_url: string | null;
  created_at: string;
  id: number;
  image_prompt: string;
  image_url: string | null;
  order: number;
  srt: string | null;
  status: WorkflowSegmentStatus;
  text: string;
  updated_at: string;
  video_no_sound: boolean;
  video_prompt: string;
  video_url: string | null;
  voice_url: string | null;
  workflow_id: number;
}

export interface StoredWorkflow {
  created_at: string;
  finalized_url: string | null;
  id: number;
  segments: StoredWorkflowSegment[];
  title: string;
  updated_at: string;
  youtube_config_id: number | null;
  youtube_publish_url: string | null;
  youtube_published_at: string | null;
  youtube_video_id: string | null;
}

export interface StoredYouTubeConfig {
  category_id: string;
  contains_synthetic_media: boolean;
  created_at: string;
  default_description: string;
  default_tags: string[];
  id: number;
  name: string;
  privacy_status: YouTubePrivacyStatus;
  self_declared_made_for_kids: boolean;
  thumbnail_url: string | null;
  title_template: string;
  updated_at: string;
  youtube_profile_id: number | null;
}

export interface YouTubeConfigInput {
  category_id?: string | null;
  contains_synthetic_media?: boolean | null;
  default_description?: string | null;
  default_tags?: string[] | null;
  name: string;
  privacy_status?: YouTubePrivacyStatus | null;
  self_declared_made_for_kids?: boolean | null;
  thumbnail_url?: string | null;
  title_template?: string | null;
  youtube_profile_id?: number | null;
}

export interface StoredYouTubeProfile {
  channel_id: string | null;
  channel_title: string | null;
  created_at: string;
  google_account_email: string | null;
  google_account_id: string | null;
  has_access_token: boolean;
  has_refresh_token: boolean;
  id: number;
  name: string;
  scope: string | null;
  token_expires_at: string | null;
  token_type: string | null;
  updated_at: string;
}

export interface YouTubeProfileInput {
  channel_id?: string | null;
  channel_title?: string | null;
  google_account_email?: string | null;
  google_account_id?: string | null;
  name: string;
}

export interface YouTubeProfileTokenInput {
  access_token?: string | null;
  refresh_token?: string | null;
  scope?: string | null;
  token_expires_at?: string | null;
  token_type?: string | null;
}

export interface StoredYouTubeProfileTokens {
  access_token: string | null;
  refresh_token: string | null;
  scope: string | null;
  token_expires_at: string | null;
  token_type: string | null;
}

export interface WorkflowSegmentUpdate {
  assembled_url?: string | null;
  image_prompt?: string;
  image_url?: string | null;
  srt?: string | null;
  status?: WorkflowSegmentStatus;
  text?: string;
  video_no_sound?: boolean;
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

let db: Database.Database | null = null;
const YOUTUBE_TOKEN_ENCRYPTION_ALGORITHM = 'aes-256-gcm';

function getYouTubeTokenEncryptionKey() {
  const masterKey = process.env.YOUTUBE_PROFILE_MASTER_KEY?.trim();
  if (!masterKey) {
    throw new Error('YOUTUBE_PROFILE_MASTER_KEY is required to store YouTube profile tokens.');
  }

  return createHash('sha256').update(masterKey).digest();
}

function encryptYouTubeToken(value: string | null | undefined) {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv(YOUTUBE_TOKEN_ENCRYPTION_ALGORITHM, getYouTubeTokenEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(normalized, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return JSON.stringify({
    alg: YOUTUBE_TOKEN_ENCRYPTION_ALGORITHM,
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    v: 1,
  });
}

function decryptYouTubeToken(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const payload = JSON.parse(value) as {
    alg?: string;
    ciphertext?: string;
    iv?: string;
    tag?: string;
    v?: number;
  };

  if (payload.v !== 1 || payload.alg !== YOUTUBE_TOKEN_ENCRYPTION_ALGORITHM || !payload.iv || !payload.tag || !payload.ciphertext) {
    throw new Error('Unsupported YouTube token encryption payload.');
  }

  const decipher = createDecipheriv(
    YOUTUBE_TOKEN_ENCRYPTION_ALGORITHM,
    getYouTubeTokenEncryptionKey(),
    Buffer.from(payload.iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

function getDb(): Database.Database {
  if (db) return db;
  const dbPath = process.env.DATABASE_PATH || './data/database.sqlite';
  const dir = dbPath.includes('/') ? dbPath.substring(0, dbPath.lastIndexOf('/')) : '.';
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  db = new Database(dbPath);
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
  db.exec(`CREATE TABLE IF NOT EXISTS youtube_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    channel_id TEXT,
    channel_title TEXT,
    google_account_id TEXT,
    google_account_email TEXT,
    access_token_encrypted TEXT,
    refresh_token_encrypted TEXT,
    token_type TEXT,
    scope TEXT,
    token_expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  const youtubeProfileColumns = db.prepare('PRAGMA table_info(youtube_profiles)').all() as Array<{ name: string }>;
  [
    ['google_account_id', 'TEXT'],
    ['google_account_email', 'TEXT'],
    ['access_token_encrypted', 'TEXT'],
    ['refresh_token_encrypted', 'TEXT'],
    ['token_type', 'TEXT'],
    ['scope', 'TEXT'],
    ['token_expires_at', 'DATETIME'],
  ].forEach(([name, type]) => {
    if (!youtubeProfileColumns.some((column) => column.name === name)) {
      db.exec(`ALTER TABLE youtube_profiles ADD COLUMN ${name} ${type}`);
    }
  });
  db.exec(`CREATE TABLE IF NOT EXISTS youtube_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    youtube_profile_id INTEGER,
    name TEXT NOT NULL,
    title_template TEXT NOT NULL DEFAULT '{workflowTitle}',
    default_description TEXT NOT NULL DEFAULT '',
    default_tags_json TEXT NOT NULL DEFAULT '[]',
    category_id TEXT NOT NULL DEFAULT '22',
    privacy_status TEXT NOT NULL DEFAULT 'private' CHECK (privacy_status IN ('private', 'public', 'unlisted')),
    self_declared_made_for_kids INTEGER NOT NULL DEFAULT 0,
    contains_synthetic_media INTEGER NOT NULL DEFAULT 1,
    thumbnail_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (youtube_profile_id) REFERENCES youtube_profiles(id) ON DELETE SET NULL
  )`);
  const youtubeConfigColumns = db.prepare('PRAGMA table_info(youtube_configs)').all() as Array<{ name: string }>;
  if (!youtubeConfigColumns.some((column) => column.name === 'youtube_profile_id')) {
    db.exec('ALTER TABLE youtube_configs ADD COLUMN youtube_profile_id INTEGER REFERENCES youtube_profiles(id) ON DELETE SET NULL');
  }
  db.exec(`CREATE TABLE IF NOT EXISTS workflows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    finalized_url TEXT,
    youtube_config_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (youtube_config_id) REFERENCES youtube_configs(id) ON DELETE SET NULL
  )`);
  const workflowColumns = db.prepare('PRAGMA table_info(workflows)').all() as Array<{ name: string }>;
  if (!workflowColumns.some((column) => column.name === 'finalized_url')) {
    db.exec('ALTER TABLE workflows ADD COLUMN finalized_url TEXT');
  }
  if (!workflowColumns.some((column) => column.name === 'youtube_config_id')) {
    db.exec('ALTER TABLE workflows ADD COLUMN youtube_config_id INTEGER REFERENCES youtube_configs(id) ON DELETE SET NULL');
  }
  if (!workflowColumns.some((column) => column.name === 'youtube_video_id')) {
    db.exec('ALTER TABLE workflows ADD COLUMN youtube_video_id TEXT');
  }
  if (!workflowColumns.some((column) => column.name === 'youtube_publish_url')) {
    db.exec('ALTER TABLE workflows ADD COLUMN youtube_publish_url TEXT');
  }
  if (!workflowColumns.some((column) => column.name === 'youtube_published_at')) {
    db.exec('ALTER TABLE workflows ADD COLUMN youtube_published_at DATETIME');
  }
  db.exec(`CREATE TABLE IF NOT EXISTS workflow_segments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id INTEGER NOT NULL,
    segment_order INTEGER NOT NULL,
    text TEXT NOT NULL DEFAULT '',
    image_prompt TEXT NOT NULL DEFAULT '',
    assembled_url TEXT,
    image_url TEXT,
    video_prompt TEXT NOT NULL DEFAULT '',
    video_url TEXT,
    voice_url TEXT,
    srt TEXT,
    video_no_sound INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'voice', 'image', 'video', 'done')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
  )`);
  const workflowSegmentColumns = db.prepare('PRAGMA table_info(workflow_segments)').all() as Array<{ name: string }>;
  if (!workflowSegmentColumns.some((column) => column.name === 'srt')) {
    db.exec('ALTER TABLE workflow_segments ADD COLUMN srt TEXT');
  }
  if (!workflowSegmentColumns.some((column) => column.name === 'assembled_url')) {
    db.exec('ALTER TABLE workflow_segments ADD COLUMN assembled_url TEXT');
  }
  if (!workflowSegmentColumns.some((column) => column.name === 'video_no_sound')) {
    db.exec('ALTER TABLE workflow_segments ADD COLUMN video_no_sound INTEGER NOT NULL DEFAULT 0');
  }
  db.exec('CREATE INDEX IF NOT EXISTS idx_workflow_segments_workflow_order ON workflow_segments (workflow_id, segment_order, id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_workflows_youtube_config ON workflows (youtube_config_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_youtube_configs_profile ON youtube_configs (youtube_profile_id)');
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
    assembled_url: row.assembled_url,
    image_url: row.image_url,
    srt: row.srt,
    video_no_sound: Boolean(row.video_no_sound),
    video_prompt: row.video_prompt,
    video_url: row.video_url,
    voice_url: row.voice_url,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function normalizeYouTubePrivacyStatus(value: unknown): YouTubePrivacyStatus {
  return value === 'public' || value === 'unlisted' || value === 'private' ? value : 'private';
}

function normalizeYouTubeTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item).trim())
    .filter(Boolean);
}

function mapYouTubeConfigRow(row: YouTubeConfigRow): StoredYouTubeConfig {
  let parsedTags: unknown = [];

  try {
    parsedTags = JSON.parse(row.default_tags_json);
  } catch {
    parsedTags = [];
  }

  return {
    id: row.id,
    youtube_profile_id: row.youtube_profile_id,
    name: row.name,
    title_template: row.title_template,
    default_description: row.default_description,
    default_tags: normalizeYouTubeTags(parsedTags),
    category_id: row.category_id,
    privacy_status: normalizeYouTubePrivacyStatus(row.privacy_status),
    self_declared_made_for_kids: Boolean(row.self_declared_made_for_kids),
    contains_synthetic_media: Boolean(row.contains_synthetic_media),
    thumbnail_url: row.thumbnail_url,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapYouTubeProfileRow(row: YouTubeProfileRow): StoredYouTubeProfile {
  return {
    id: row.id,
    name: row.name,
    channel_id: row.channel_id,
    channel_title: row.channel_title,
    google_account_id: row.google_account_id,
    google_account_email: row.google_account_email,
    has_access_token: Boolean(row.access_token_encrypted),
    has_refresh_token: Boolean(row.refresh_token_encrypted),
    scope: row.scope,
    token_expires_at: row.token_expires_at,
    token_type: row.token_type,
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
    finalized_url: row.finalized_url,
    youtube_config_id: row.youtube_config_id,
    youtube_video_id: row.youtube_video_id,
    youtube_publish_url: row.youtube_publish_url,
    youtube_published_at: row.youtube_published_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    segments: segmentsByWorkflow.get(row.id) ?? [],
  }));
}

export function savePrompt(text: string) {
  const database = getDb();
  database.prepare('INSERT INTO prompts (text) VALUES (?)').run(text);
}

export function getPrompts(): { id: number; text: string; created_at: string }[] {
  const database = getDb();
  return database.prepare('SELECT id, text, created_at FROM prompts ORDER BY created_at DESC').all() as any;
}

export function deletePrompt(id: number) {
  const database = getDb();
  database.prepare('DELETE FROM prompts WHERE id = ?').run(id);
}

export function saveSystemPrompt(name: string, text: string) {
  const database = getDb();
  database.prepare('INSERT INTO system_prompts (name, text) VALUES (?, ?)').run(name, text);
}

export function getSystemPrompts(): { id: number; name: string; text: string; created_at: string }[] {
  const database = getDb();
  return database.prepare('SELECT id, name, text, created_at FROM system_prompts ORDER BY created_at DESC').all() as any;
}

export function getSystemPromptById(id: number): { id: number; name: string; text: string; created_at: string } | null {
  const database = getDb();
  return (database.prepare('SELECT id, name, text, created_at FROM system_prompts WHERE id = ?').get(id) as any) ?? null;
}

export function deleteSystemPrompt(id: number) {
  const database = getDb();
  database.prepare('DELETE FROM system_prompts WHERE id = ?').run(id);
}

export function saveStyleDnaProfile(name: string, profile: StyleDnaProfile) {
  const database = getDb();
  const normalizedProfile = normalizeStyleDnaProfile(profile);
  const result = database.prepare('INSERT INTO style_dna_profiles (name, profile_json) VALUES (?, ?)').run(name, JSON.stringify(normalizedProfile));
  return getStyleDnaProfileById(Number(result.lastInsertRowid));
}

export function getStyleDnaProfiles(): StoredStyleDnaProfile[] {
  const database = getDb();
  const rows = database.prepare('SELECT id, name, profile_json, created_at FROM style_dna_profiles ORDER BY created_at DESC, id DESC').all() as StyleDnaProfileRow[];
  return rows.map(mapStyleDnaProfileRow);
}

export function getStyleDnaProfileById(id: number): StoredStyleDnaProfile | null {
  const database = getDb();
  const row = (database.prepare('SELECT id, name, profile_json, created_at FROM style_dna_profiles WHERE id = ?').get(id) as StyleDnaProfileRow | undefined) ?? null;
  return row ? mapStyleDnaProfileRow(row) : null;
}

export function deleteStyleDnaProfile(id: number) {
  const database = getDb();
  database.prepare('DELETE FROM style_dna_profiles WHERE id = ?').run(id);
}

export function createYouTubeProfile(input: YouTubeProfileInput): StoredYouTubeProfile | null {
  const database = getDb();
  const name = input.name.trim();
  if (!name) {
    throw new Error('YouTube profile name is required.');
  }

  const result = database.prepare(`
    INSERT INTO youtube_profiles (name, channel_id, channel_title, google_account_id, google_account_email)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    name,
    input.channel_id?.trim() || null,
    input.channel_title?.trim() || null,
    input.google_account_id?.trim() || null,
    input.google_account_email?.trim() || null,
  );

  return getYouTubeProfileById(Number(result.lastInsertRowid));
}

export function getYouTubeProfiles(): StoredYouTubeProfile[] {
  const database = getDb();
  const rows = database.prepare(`
    SELECT
      id,
      name,
      channel_id,
      channel_title,
      google_account_id,
      google_account_email,
      access_token_encrypted,
      refresh_token_encrypted,
      token_type,
      scope,
      token_expires_at,
      created_at,
      updated_at
    FROM youtube_profiles
    ORDER BY updated_at DESC, id DESC
  `).all() as YouTubeProfileRow[];
  return rows.map(mapYouTubeProfileRow);
}

export function getYouTubeProfileById(id: number): StoredYouTubeProfile | null {
  const database = getDb();
  const row = database.prepare(`
    SELECT
      id,
      name,
      channel_id,
      channel_title,
      google_account_id,
      google_account_email,
      access_token_encrypted,
      refresh_token_encrypted,
      token_type,
      scope,
      token_expires_at,
      created_at,
      updated_at
    FROM youtube_profiles
    WHERE id = ?
  `).get(id) as YouTubeProfileRow | undefined;
  return row ? mapYouTubeProfileRow(row) : null;
}

export function updateYouTubeProfile(id: number, input: YouTubeProfileInput): StoredYouTubeProfile | null {
  const database = getDb();
  const profile = getYouTubeProfileById(id);
  if (!profile) {
    return null;
  }

  const name = input.name.trim();
  if (!name) {
    throw new Error('YouTube profile name is required.');
  }

  database.prepare(`
    UPDATE youtube_profiles
    SET
      name = ?,
      channel_id = ?,
      channel_title = ?,
      google_account_id = ?,
      google_account_email = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    name,
    input.channel_id?.trim() || null,
    input.channel_title?.trim() || null,
    input.google_account_id?.trim() || null,
    input.google_account_email?.trim() || null,
    id,
  );

  return getYouTubeProfileById(id);
}

export function deleteYouTubeProfile(id: number) {
  const database = getDb();
  database.prepare('UPDATE youtube_configs SET youtube_profile_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE youtube_profile_id = ?').run(id);
  database.prepare('DELETE FROM youtube_profiles WHERE id = ?').run(id);
}

export function saveYouTubeProfileTokens(id: number, input: YouTubeProfileTokenInput): StoredYouTubeProfile | null {
  const database = getDb();
  const profile = getYouTubeProfileById(id);
  if (!profile) {
    return null;
  }

  database.prepare(`
    UPDATE youtube_profiles
    SET
      access_token_encrypted = COALESCE(?, access_token_encrypted),
      refresh_token_encrypted = COALESCE(?, refresh_token_encrypted),
      token_type = COALESCE(?, token_type),
      scope = COALESCE(?, scope),
      token_expires_at = COALESCE(?, token_expires_at),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    input.access_token === undefined ? null : encryptYouTubeToken(input.access_token),
    input.refresh_token === undefined ? null : encryptYouTubeToken(input.refresh_token),
    input.token_type?.trim() || null,
    input.scope?.trim() || null,
    input.token_expires_at?.trim() || null,
    id,
  );

  return getYouTubeProfileById(id);
}

export function getYouTubeProfileTokens(id: number): StoredYouTubeProfileTokens | null {
  const database = getDb();
  const row = database.prepare(`
    SELECT
      access_token_encrypted,
      refresh_token_encrypted,
      token_type,
      scope,
      token_expires_at
    FROM youtube_profiles
    WHERE id = ?
  `).get(id) as Pick<YouTubeProfileRow, 'access_token_encrypted' | 'refresh_token_encrypted' | 'token_type' | 'scope' | 'token_expires_at'> | undefined;

  if (!row) {
    return null;
  }

  return {
    access_token: decryptYouTubeToken(row.access_token_encrypted),
    refresh_token: decryptYouTubeToken(row.refresh_token_encrypted),
    scope: row.scope,
    token_expires_at: row.token_expires_at,
    token_type: row.token_type,
  };
}

export function createYouTubeConfig(input: YouTubeConfigInput): StoredYouTubeConfig | null {
  const database = getDb();
  const name = input.name.trim();
  if (!name) {
    throw new Error('YouTube config name is required.');
  }
  const youtubeProfileId = input.youtube_profile_id ?? null;
  if (youtubeProfileId !== null && !getYouTubeProfileById(youtubeProfileId)) {
    throw new Error('YouTube profile does not exist.');
  }

  const result = database.prepare(`
    INSERT INTO youtube_configs (
      youtube_profile_id,
      name,
      title_template,
      default_description,
      default_tags_json,
      category_id,
      privacy_status,
      self_declared_made_for_kids,
      contains_synthetic_media,
      thumbnail_url
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    youtubeProfileId,
    name,
    input.title_template?.trim() || '{workflowTitle}',
    input.default_description?.trim() || '',
    JSON.stringify(normalizeYouTubeTags(input.default_tags ?? [])),
    input.category_id?.trim() || '22',
    normalizeYouTubePrivacyStatus(input.privacy_status),
    Number(Boolean(input.self_declared_made_for_kids)),
    input.contains_synthetic_media === undefined || input.contains_synthetic_media === null ? 1 : Number(Boolean(input.contains_synthetic_media)),
    input.thumbnail_url?.trim() || null,
  );

  return getYouTubeConfigById(Number(result.lastInsertRowid));
}

export function getYouTubeConfigs(): StoredYouTubeConfig[] {
  const database = getDb();
  const rows = database.prepare(`
    SELECT
      id,
      youtube_profile_id,
      name,
      title_template,
      default_description,
      default_tags_json,
      category_id,
      privacy_status,
      self_declared_made_for_kids,
      contains_synthetic_media,
      thumbnail_url,
      created_at,
      updated_at
    FROM youtube_configs
    ORDER BY updated_at DESC, id DESC
  `).all() as YouTubeConfigRow[];
  return rows.map(mapYouTubeConfigRow);
}

export function getYouTubeConfigById(id: number): StoredYouTubeConfig | null {
  const database = getDb();
  const row = database.prepare(`
    SELECT
      id,
      youtube_profile_id,
      name,
      title_template,
      default_description,
      default_tags_json,
      category_id,
      privacy_status,
      self_declared_made_for_kids,
      contains_synthetic_media,
      thumbnail_url,
      created_at,
      updated_at
    FROM youtube_configs
    WHERE id = ?
  `).get(id) as YouTubeConfigRow | undefined;
  return row ? mapYouTubeConfigRow(row) : null;
}

export function updateYouTubeConfig(id: number, input: YouTubeConfigInput): StoredYouTubeConfig | null {
  const database = getDb();
  const config = getYouTubeConfigById(id);
  if (!config) {
    return null;
  }

  const name = input.name.trim();
  if (!name) {
    throw new Error('YouTube config name is required.');
  }
  const youtubeProfileId = input.youtube_profile_id ?? null;
  if (youtubeProfileId !== null && !getYouTubeProfileById(youtubeProfileId)) {
    throw new Error('YouTube profile does not exist.');
  }

  database.prepare(`
    UPDATE youtube_configs
    SET
      youtube_profile_id = ?,
      name = ?,
      title_template = ?,
      default_description = ?,
      default_tags_json = ?,
      category_id = ?,
      privacy_status = ?,
      self_declared_made_for_kids = ?,
      contains_synthetic_media = ?,
      thumbnail_url = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    youtubeProfileId,
    name,
    input.title_template?.trim() || '{workflowTitle}',
    input.default_description?.trim() || '',
    JSON.stringify(normalizeYouTubeTags(input.default_tags ?? [])),
    input.category_id?.trim() || '22',
    normalizeYouTubePrivacyStatus(input.privacy_status),
    Number(Boolean(input.self_declared_made_for_kids)),
    input.contains_synthetic_media === undefined || input.contains_synthetic_media === null ? 1 : Number(Boolean(input.contains_synthetic_media)),
    input.thumbnail_url?.trim() || null,
    id,
  );

  return getYouTubeConfigById(id);
}

export function deleteYouTubeConfig(id: number) {
  const database = getDb();
  database.prepare('UPDATE workflows SET youtube_config_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE youtube_config_id = ?').run(id);
  database.prepare('DELETE FROM youtube_configs WHERE id = ?').run(id);
}

export function updateWorkflowYouTubeConfig(workflowId: number, youtubeConfigId: number | null): StoredWorkflow | null {
  const database = getDb();
  const workflow = getWorkflowById(workflowId);
  if (!workflow) {
    return null;
  }

  if (youtubeConfigId !== null && !getYouTubeConfigById(youtubeConfigId)) {
    throw new Error('YouTube config does not exist.');
  }

  database.prepare(`
    UPDATE workflows
    SET youtube_config_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(youtubeConfigId, workflowId);

  return getWorkflowById(workflowId);
}

export function createWorkflow(title: string, segments: WorkflowSegmentInput[]): StoredWorkflow | null {
  const database = getDb();
  const normalizedTitle = title.trim();
  const normalizedSegments = segments
    .map((segment, index) => ({
      order: Number.isFinite(Number(segment.order)) ? Number(segment.order) : index + 1,
      text: String(segment.text ?? '').trim(),
      image_prompt: String(segment.image_prompt ?? '').trim(),
      assembled_url: segment.assembled_url?.trim() || null,
      image_url: segment.image_url?.trim() || null,
      srt: segment.srt?.trim() || null,
      video_no_sound: Boolean(segment.video_no_sound),
      video_prompt: String(segment.video_prompt ?? '').trim(),
      video_url: segment.video_url?.trim() || null,
      voice_url: segment.voice_url?.trim() || null,
    }))
    .filter((segment) => segment.text || segment.image_prompt || segment.video_prompt);

  const create = database.transaction(() => {
    const workflowResult = database.prepare('INSERT INTO workflows (title) VALUES (?)').run(normalizedTitle);
    const workflowId = Number(workflowResult.lastInsertRowid);
    const insertSegment = database.prepare(`
      INSERT INTO workflow_segments (
        workflow_id,
        segment_order,
        text,
        image_prompt,
        assembled_url,
        image_url,
        srt,
        video_no_sound,
        video_prompt,
        video_url,
        voice_url
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    normalizedSegments.forEach((segment) => {
      insertSegment.run(
        workflowId,
        segment.order,
        segment.text,
        segment.image_prompt,
        segment.assembled_url,
        segment.image_url,
        segment.srt,
        Number(segment.video_no_sound),
        segment.video_prompt,
        segment.video_url,
        segment.voice_url,
      );
    });

    return workflowId;
  });

  return getWorkflowById(create());
}

export function getWorkflows(): StoredWorkflow[] {
  const database = getDb();
  const workflowRows = database.prepare(`
    SELECT
      id,
      title,
      finalized_url,
      youtube_config_id,
      youtube_video_id,
      youtube_publish_url,
      youtube_published_at,
      created_at,
      updated_at
    FROM workflows
    ORDER BY updated_at DESC, id DESC
  `).all() as WorkflowRow[];
  const segmentRows = database.prepare(`
    SELECT
      id,
      workflow_id,
      segment_order,
      text,
      image_prompt,
      assembled_url,
      image_url,
      srt,
      video_no_sound,
      video_prompt,
      video_url,
      voice_url,
      status,
      created_at,
      updated_at
    FROM workflow_segments
    ORDER BY workflow_id, segment_order, id
  `).all() as WorkflowSegmentRow[];

  return mapWorkflowRows(workflowRows, segmentRows);
}

export function getWorkflowById(id: number): StoredWorkflow | null {
  const database = getDb();
  const workflowRow = database.prepare(`
    SELECT
      id,
      title,
      finalized_url,
      youtube_config_id,
      youtube_video_id,
      youtube_publish_url,
      youtube_published_at,
      created_at,
      updated_at
    FROM workflows
    WHERE id = ?
  `).get(id) as WorkflowRow | undefined;
  if (!workflowRow) {
    return null;
  }

  const segmentRows = database.prepare(`
    SELECT
      id,
      workflow_id,
      segment_order,
      text,
      image_prompt,
      assembled_url,
      image_url,
      srt,
      video_no_sound,
      video_prompt,
      video_url,
      voice_url,
      status,
      created_at,
      updated_at
    FROM workflow_segments
    WHERE workflow_id = ?
    ORDER BY segment_order, id
  `).all(id) as WorkflowSegmentRow[];

  return mapWorkflowRows([workflowRow], segmentRows)[0] ?? null;
}

export function deleteWorkflow(id: number): StoredWorkflow | null {
  const database = getDb();
  const workflow = getWorkflowById(id);
  if (!workflow) {
    return null;
  }

  database.transaction(() => {
    database.prepare('DELETE FROM workflow_segments WHERE workflow_id = ?').run(id);
    database.prepare('DELETE FROM workflows WHERE id = ?').run(id);
  })();

  return workflow;
}

export function updateWorkflowFinalizedUrl(id: number, finalizedUrl: string | null): StoredWorkflow | null {
  const database = getDb();
  const current = getWorkflowById(id);
  if (!current) {
    return null;
  }

  if (current.finalized_url !== finalizedUrl) {
    database.prepare(`
      UPDATE workflows
      SET
        finalized_url = ?,
        youtube_video_id = NULL,
        youtube_publish_url = NULL,
        youtube_published_at = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(finalizedUrl, id);
  } else {
    database.prepare(`
      UPDATE workflows
      SET finalized_url = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(finalizedUrl, id);
  }

  return getWorkflowById(id);
}

export function updateWorkflowYouTubePublishResult(id: number, videoId: string, publishUrl: string): StoredWorkflow | null {
  const database = getDb();
  const current = getWorkflowById(id);
  if (!current) {
    return null;
  }

  database.prepare(`
    UPDATE workflows
    SET
      youtube_video_id = ?,
      youtube_publish_url = ?,
      youtube_published_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(videoId, publishUrl, id);

  return getWorkflowById(id);
}

export function getWorkflowSegmentById(id: number): StoredWorkflowSegment | null {
  const database = getDb();
  const row = database.prepare(`
    SELECT
      id,
      workflow_id,
      segment_order,
      text,
      image_prompt,
      assembled_url,
      image_url,
      srt,
      video_no_sound,
      video_prompt,
      video_url,
      voice_url,
      status,
      created_at,
      updated_at
    FROM workflow_segments
    WHERE id = ?
  `).get(id) as WorkflowSegmentRow | undefined;

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
    assembled_url: updates.assembled_url === undefined ? current.assembled_url : updates.assembled_url,
    image_url: updates.image_url === undefined ? current.image_url : updates.image_url,
    srt: updates.srt === undefined ? current.srt : updates.srt,
    video_no_sound: updates.video_no_sound === undefined ? current.video_no_sound : updates.video_no_sound,
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
      assembled_url = ?,
      image_url = ?,
      srt = ?,
      video_no_sound = ?,
      video_prompt = ?,
      video_url = ?,
      voice_url = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    next.status,
    next.text,
    next.image_prompt,
    next.assembled_url,
    next.image_url,
    next.srt,
    Number(next.video_no_sound),
    next.video_prompt,
    next.video_url,
    next.voice_url,
    id,
  );

  const segmentChanged =
    next.status !== current.status
    || next.text !== current.text
    || next.image_prompt !== current.image_prompt
    || next.assembled_url !== current.assembled_url
    || next.image_url !== current.image_url
    || next.srt !== current.srt
    || next.video_no_sound !== current.video_no_sound
    || next.video_prompt !== current.video_prompt
    || next.video_url !== current.video_url
    || next.voice_url !== current.voice_url;

  if (segmentChanged) {
    database.prepare(`
      UPDATE workflows
      SET finalized_url = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(current.workflow_id);
  } else {
    database.prepare('UPDATE workflows SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(current.workflow_id);
  }

  return getWorkflowSegmentById(id);
}

export function getThreadsAuth(): StoredThreadsAuth | null {
  const database = getDb();
  return (database.prepare('SELECT access_token, user_id, expires_at, created_at, updated_at FROM threads_auth WHERE id = 1').get() as ThreadsAuthRow | undefined) ?? null;
}

export function saveThreadsAuth(input: { accessToken: string; expiresAt?: string | null; userId?: string | null }) {
  const database = getDb();
  database.prepare(`
    INSERT INTO threads_auth (id, access_token, user_id, expires_at, created_at, updated_at)
    VALUES (1, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      access_token = excluded.access_token,
      user_id = excluded.user_id,
      expires_at = excluded.expires_at,
      updated_at = CURRENT_TIMESTAMP
  `).run(input.accessToken, input.userId ?? null, input.expiresAt ?? null);
  return getThreadsAuth();
}

export function deleteThreadsAuth() {
  const database = getDb();
  database.prepare('DELETE FROM threads_auth WHERE id = 1').run();
}
