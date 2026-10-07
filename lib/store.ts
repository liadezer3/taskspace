import { randomUUID } from 'crypto';
import { q } from './db';
import { Space, Task, isPriority, isStatus, isView } from './constants';

const TASK_COLS = `id, space_id, title, description, priority, status, due_date, completed_at, position, created_at, updated_at`;

export async function listSpaces(): Promise<Space[]> {
  return q<Space>(`select id, name, color, view, position from spaces order by position, created_at`);
}

export async function listTasks(spaceIds?: string[]): Promise<Task[]> {
  if (spaceIds) {
    if (!spaceIds.length) return [];
    return q<Task>(`select ${TASK_COLS} from tasks where space_id = any($1) order by position, created_at`, [spaceIds]);
  }
  return q<Task>(`select ${TASK_COLS} from tasks order by position, created_at`);
}

export async function getTask(id: string): Promise<Task | null> {
  const r = await q<Task>(`select ${TASK_COLS} from tasks where id = $1`, [id]);
  return r[0] ?? null;
}

const isDate = (v: any) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

export async function createSpace(input: { name: string; color?: string; view?: string }): Promise<Space> {
  const name = String(input.name ?? '').trim().slice(0, 60);
  if (!name) throw new Error('שם המרחב חסר');
  const color = /^#[0-9a-fA-F]{6}$/.test(input.color ?? '') ? input.color! : '#6366f1';
  const view = isView(input.view) ? input.view : 'kanban';
  const pos = (await q<{ m: number }>(`select coalesce(max(position), -1) + 1 as m from spaces`))[0].m;
  const id = randomUUID();
  await q(`insert into spaces (id, name, color, view, position) values ($1,$2,$3,$4,$5)`, [id, name, color, view, pos]);
  return { id, name, color, view, position: pos };
}

export async function updateSpace(id: string, patch: Partial<Space>): Promise<Space | null> {
  const sets: string[] = [];
  const vals: any[] = [];
  const add = (col: string, v: any) => { vals.push(v); sets.push(`${col} = $${vals.length}`); };
  if (patch.name !== undefined) { const n = String(patch.name).trim().slice(0, 60); if (!n) throw new Error('שם המרחב חסר'); add('name', n); }
  if (patch.color !== undefined && /^#[0-9a-fA-F]{6}$/.test(patch.color)) add('color', patch.color);
  if (patch.view !== undefined && isView(patch.view)) add('view', patch.view);
  if (patch.position !== undefined && Number.isFinite(patch.position)) add('position', Math.trunc(patch.position));
  if (!sets.length) return (await q<Space>(`select id, name, color, view, position from spaces where id=$1`, [id]))[0] ?? null;
  vals.push(id);
  const r = await q<Space>(`update spaces set ${sets.join(', ')} where id = $${vals.length} returning id, name, color, view, position`, vals);
  return r[0] ?? null;
}

export async function deleteSpace(id: string) {
  await q(`delete from spaces where id = $1`, [id]);
}

export type TaskInput = {
  space_id: string;
  title: string;
  description?: string;
  priority?: string;
  status?: string;
  due_date?: string | null;
  position?: number;
};

export async function createTask(input: TaskInput): Promise<Task> {
  const title = String(input.title ?? '').trim().slice(0, 300);
  if (!title) throw new Error('כותרת המשימה חסרה');
  const sp = await q(`select 1 from spaces where id = $1`, [input.space_id]);
  if (!sp.length) throw new Error('המרחב לא נמצא');
  const priority = isPriority(input.priority) ? input.priority : 'medium';
  const status = isStatus(input.status) ? input.status : 'new';
  const due = isDate(input.due_date) ? input.due_date : null;
  const id = randomUUID();
  const position = Number.isFinite(input.position) ? input.position! : (await q<{ m: number }>(`select coalesce(max(position), 0) + 1000 as m from tasks`))[0].m;
  const r = await q<Task>(
    `insert into tasks (id, space_id, title, description, priority, status, due_date, completed_at, position)
     values ($1,$2,$3,$4,$5,$6,$7, case when $6 = 'done' then now() else null end, $8)
     returning ${TASK_COLS}`,
    [id, input.space_id, title, String(input.description ?? '').slice(0, 5000), priority, status, due, position]
  );
  return r[0];
}

export async function updateTask(id: string, patch: Partial<TaskInput>): Promise<Task | null> {
  const sets: string[] = [];
  const vals: any[] = [];
  const add = (col: string, v: any) => { vals.push(v); sets.push(`${col} = $${vals.length}`); };
  if (patch.title !== undefined) { const t = String(patch.title).trim().slice(0, 300); if (!t) throw new Error('כותרת המשימה חסרה'); add('title', t); }
  if (patch.description !== undefined) add('description', String(patch.description).slice(0, 5000));
  if (patch.priority !== undefined && isPriority(patch.priority)) add('priority', patch.priority);
  if (patch.status !== undefined && isStatus(patch.status)) {
    add('status', patch.status);
    sets.push(patch.status === 'done' ? `completed_at = coalesce(completed_at, now())` : `completed_at = null`);
  }
  if (patch.due_date !== undefined) add('due_date', isDate(patch.due_date) ? patch.due_date : null);
  if (patch.space_id !== undefined) {
    const sp = await q(`select 1 from spaces where id = $1`, [patch.space_id]);
    if (!sp.length) throw new Error('המרחב לא נמצא');
    add('space_id', patch.space_id);
  }
  if (patch.position !== undefined && Number.isFinite(patch.position)) add('position', patch.position);
  if (!sets.length) return getTask(id);
  sets.push(`updated_at = now()`);
  vals.push(id);
  const r = await q<Task>(`update tasks set ${sets.join(', ')} where id = $${vals.length} returning ${TASK_COLS}`, vals);
  return r[0] ?? null;
}

export async function deleteTask(id: string) {
  await q(`delete from tasks where id = $1`, [id]);
}

export async function deleteTasks(ids: string[]) {
  if (ids.length) await q(`delete from tasks where id = any($1)`, [ids]);
}
