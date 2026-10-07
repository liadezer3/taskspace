// Seeds sample data: 3 spaces (home / work / study) with 15 tasks. Idempotent unless --force.
import pg from 'pg';
import { randomUUID } from 'node:crypto';

pg.types.setTypeParser(1082, (v) => v);
const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL is not set'); process.exit(1); }
const local = /localhost|127\.0\.0\.1/.test(url);
const clean = url.replace(/([?&])sslmode=[^&]*&?/, '$1').replace(/[?&]$/, '');
const pool = new pg.Pool({ connectionString: clean, ssl: local ? false : { rejectUnauthorized: false } });

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());
const add = (n) => { const d = new Date(today + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const daysAgoTs = (n) => new Date(Date.now() - n * 86400000).toISOString();

await pool.query(`
  create table if not exists spaces (id text primary key, name text not null, color text not null default '#6366f1', view text not null default 'kanban', position int not null default 0, created_at timestamptz not null default now());
  create table if not exists tasks (id text primary key, space_id text not null references spaces(id) on delete cascade, title text not null, description text not null default '', priority text not null default 'medium', status text not null default 'new', due_date date, completed_at timestamptz, position double precision not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
  create index if not exists tasks_space_idx on tasks(space_id);
`);

const force = process.argv.includes('--force');
const { rows } = await pool.query('select count(*)::int as n from spaces');
if (rows[0].n > 0 && !force) { console.log(`Already has ${rows[0].n} spaces — skipping (use --force to reset).`); await pool.end(); process.exit(0); }
if (force) await pool.query('delete from tasks; delete from spaces;');

// [title, priority, status, due offset (days from today) | null, completed N days ago]
const data = [
  { name: 'בית', color: '#14b8a6', view: 'todo', tasks: [
    ['לקנות חלב ולחם', 'medium', 'new', 0],
    ['לשלם ארנונה', 'urgent', 'new', 2],
    ['להתקשר לסבתא', 'high', 'new', 1],
    ['לתקן את הברז במטבח', 'low', 'paused', 9],
    ['לסדר את המחסן', 'low', 'new', null],
    ['לקבוע תור לרופא שיניים', 'medium', 'done', -3, 1],
  ]},
  { name: 'עבודה', color: '#6366f1', view: 'kanban', tasks: [
    ['להכין מצגת לפגישת צוות', 'urgent', 'in_progress', 0],
    ['לשלוח הצעת מחיר ללקוח', 'high', 'new', -2],
    ['לעדכן את תיעוד המערכת', 'medium', 'paused', 6],
    ['לסקור קוד של הצוות', 'medium', 'in_progress', 1],
    ['לסגור דוח חודשי', 'high', 'done', -1, 2],
  ]},
  { name: 'לימודים', color: '#f97316', view: 'calendar', tasks: [
    ['להגיש עבודה בקורס רשתות', 'urgent', 'in_progress', 3],
    ['ללמוד למבחן באלגוריתמים', 'high', 'new', 8],
    ['לקרוא פרק 5 בספר', 'low', 'new', 4],
    ['תרגיל בית בפייתון', 'medium', 'new', -1],
    ['להירשם לקורס קיץ', 'low', 'done', -5, 3],
  ]},
];

let total = 0;
for (let si = 0; si < data.length; si++) {
  const s = data[si];
  const sid = randomUUID();
  await pool.query('insert into spaces (id, name, color, view, position) values ($1,$2,$3,$4,$5)', [sid, s.name, s.color, s.view, si]);
  for (let i = 0; i < s.tasks.length; i++) {
    const [title, priority, status, off, doneAgo] = s.tasks[i];
    await pool.query(
      `insert into tasks (id, space_id, title, priority, status, due_date, completed_at, position) values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [randomUUID(), sid, title, priority, status, off === null ? null : add(off), status === 'done' ? daysAgoTs(doneAgo ?? 1) : null, (total + 1) * 1000]
    );
    total++;
  }
}
console.log(`Seeded ${data.length} spaces and ${total} tasks.`);
await pool.end();
