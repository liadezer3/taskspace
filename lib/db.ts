import { Pool, types } from 'pg';

// Return DATE columns as plain 'YYYY-MM-DD' strings (no timezone shifting)
types.setTypeParser(1082, (v: string) => v);

const g = globalThis as unknown as { _pool?: Pool; _schema?: Promise<void> };

export function getPool(): Pool {
  if (!g._pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    const local = /localhost|127\.0\.0\.1/.test(url);
    // strip sslmode from the URL so the explicit ssl option below is authoritative
    const clean = url.replace(/([?&])sslmode=[^&]*&?/, '$1').replace(/[?&]$/, '');
    g._pool = new Pool({
      connectionString: clean,
      ssl: local ? false : { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 20000,
    });
  }
  return g._pool;
}

export async function ensureSchema() {
  if (!g._schema) {
    g._schema = (async () => {
      const p = getPool();
      await p.query(`
        create table if not exists spaces (
          id text primary key,
          name text not null,
          color text not null default '#6366f1',
          view text not null default 'kanban',
          position int not null default 0,
          created_at timestamptz not null default now()
        );
        create table if not exists tasks (
          id text primary key,
          space_id text not null references spaces(id) on delete cascade,
          title text not null,
          description text not null default '',
          priority text not null default 'medium',
          status text not null default 'new',
          due_date date,
          completed_at timestamptz,
          position double precision not null default 0,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        );
        create index if not exists tasks_space_idx on tasks(space_id);
      `);
    })().catch((e) => {
      g._schema = undefined;
      throw e;
    });
  }
  return g._schema;
}

export async function q<T = any>(text: string, params: any[] = []): Promise<T[]> {
  await ensureSchema();
  const r = await getPool().query(text, params);
  return r.rows as T[];
}
