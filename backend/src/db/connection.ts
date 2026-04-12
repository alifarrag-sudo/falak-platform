/**
 * Unified async database interface for Falak platform.
 *
 * Behaviour:
 *   DATABASE_URL set  →  PostgreSQL (Neon / any pg-compatible host)
 *   DATABASE_URL unset →  SQLite via Node.js built-in `node:sqlite`
 *
 * All callers use `?` positional parameters — this module auto-converts to
 * `$1, $2, …` before sending to PostgreSQL.
 */

import { Pool } from 'pg';
// `node:sqlite` is available in Node 22+; it is a CommonJS-compatible built-in.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nodeSqlite = require('node:sqlite');
import path from 'path';
import fs from 'fs';

// ── Types ────────────────────────────────────────────────────────────────────

export interface DbRow {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface DbResult {
  rows: DbRow[];
  rowCount: number;
}

// ── PostgreSQL pool (lazy singleton) ─────────────────────────────────────────

let _pool: Pool | null = null;

function getPool(): Pool {
  if (!_pool) {
    _pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }   // Neon requires SSL
        : false,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
    _pool.on('error', (err) => {
      console.error('[pg pool] unexpected error', err);
    });
  }
  return _pool;
}

// ── SQLite connection (lazy singleton) ───────────────────────────────────────

let _sqlite: InstanceType<typeof nodeSqlite.DatabaseSync> | null = null;

function getSqlite() {
  if (!_sqlite) {
    const dbPath = process.env.DB_PATH
      ? path.resolve(process.cwd(), process.env.DB_PATH)
      : path.join(__dirname, '../../../data/influencers.db');

    const dataDir = path.dirname(dbPath);
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

    _sqlite = new nodeSqlite.DatabaseSync(dbPath);
    _sqlite.exec('PRAGMA journal_mode = WAL');
    _sqlite.exec('PRAGMA foreign_keys = ON');
    _sqlite.exec("PRAGMA encoding = 'UTF-8'");
  }
  return _sqlite;
}

// ── Parameter conversion: ? → $1,$2,… ────────────────────────────────────────

function toPositional(sql: string): string {
  let n = 0;
  return sql.replace(/\?/g, () => `$${++n}`);
}

// ── Detect write vs. select ───────────────────────────────────────────────────

function isSelect(sql: string): boolean {
  const s = sql.trimStart().toUpperCase();
  return s.startsWith('SELECT') || s.startsWith('WITH') || s.startsWith('EXPLAIN');
}

// ── Public interface ─────────────────────────────────────────────────────────

export const db = {
  /**
   * Execute any SQL with optional positional `?` parameters.
   * Returns `{ rows, rowCount }` for all query types.
   */
  async query(sql: string, params: unknown[] = []): Promise<DbResult> {
    if (process.env.DATABASE_URL) {
      const pgSql = toPositional(sql);
      const result = await getPool().query(pgSql, params);
      return { rows: result.rows, rowCount: result.rowCount ?? 0 };
    }

    // SQLite mode
    const sqlite = getSqlite();
    if (isSelect(sql)) {
      const rows = sqlite.prepare(sql).all(...params) as DbRow[];
      return { rows, rowCount: rows.length };
    }
    const info = sqlite.prepare(sql).run(...params) as { changes: number };
    return { rows: [], rowCount: info.changes };
  },

  /** Returns the first matching row, or `undefined`. */
  async get(sql: string, params: unknown[] = []): Promise<DbRow | undefined> {
    const { rows } = await this.query(sql, params);
    return rows[0];
  },

  /** Returns all matching rows. */
  async all(sql: string, params: unknown[] = []): Promise<DbRow[]> {
    const { rows } = await this.query(sql, params);
    return rows;
  },

  /** Executes a write (INSERT / UPDATE / DELETE) and returns rowCount. */
  async run(sql: string, params: unknown[] = []): Promise<DbResult> {
    return this.query(sql, params);
  },

  /**
   * Execute raw DDL / multi-statement SQL (schema migrations, triggers).
   * PostgreSQL mode: executes via pool.
   * SQLite mode: uses DatabaseSync.exec().
   */
  async exec(sql: string): Promise<void> {
    if (process.env.DATABASE_URL) {
      await getPool().query(sql);
    } else {
      getSqlite().exec(sql);
    }
  },

  /**
   * Wraps a function in a transaction.
   * The callback receives the same `db`-shaped interface bound to the transaction.
   */
  async transaction<T>(
    fn: (t: Pick<typeof db, 'query' | 'get' | 'all' | 'run'>) => Promise<T>
  ): Promise<T> {
    if (process.env.DATABASE_URL) {
      const client = await getPool().connect();
      try {
        await client.query('BEGIN');
        const t = {
          async query(sql: string, params: unknown[] = []): Promise<DbResult> {
            const r = await client.query(toPositional(sql), params);
            return { rows: r.rows, rowCount: r.rowCount ?? 0 };
          },
          async get(sql: string, params: unknown[] = []): Promise<DbRow | undefined> {
            const { rows } = await t.query(sql, params);
            return rows[0];
          },
          async all(sql: string, params: unknown[] = []): Promise<DbRow[]> {
            const { rows } = await t.query(sql, params);
            return rows;
          },
          async run(sql: string, params: unknown[] = []): Promise<DbResult> {
            return t.query(sql, params);
          },
        };
        const result = await fn(t);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    // SQLite — DatabaseSync doesn't need async transactions; wrap synchronously
    return fn({
      query: this.query.bind(this),
      get: this.get.bind(this),
      all: this.all.bind(this),
      run: this.run.bind(this),
    });
  },

  /** Expose pool for raw pg.Client access when needed. */
  getPool,
};

export default db;
