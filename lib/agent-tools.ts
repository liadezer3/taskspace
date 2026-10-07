import { PRIORITIES, PRIORITY_MAP, STATUS_MAP, Space, Task, isPriority, isStatus } from './constants';
import { addDays, todayIL, weekStart } from './dates';
import { createTask, deleteTasks, listSpaces, listTasks, updateTask } from './store';

export type Scope = { mode: 'all' } | { mode: 'space'; spaceId: string };
export type ToolCall = { name: string; args: any };
export type ToolResult = { ok: boolean; affected: number; message: string; data?: any };

export const MUTATING = new Set(['add_tasks', 'update_tasks', 'delete_tasks']);
export const CONFIRM_THRESHOLD = 3; // more than this many tasks => ask first

const PRI = ['low', 'medium', 'high', 'urgent'];
const STA = ['new', 'in_progress', 'paused', 'done'];

const filterSchema = {
  type: 'object',
  description: 'סינון משימות. כל השדות אופציונליים והם משולבים ב-AND. ללא שדות = כל המשימות בטווח העבודה.',
  properties: {
    ids: { type: 'array', items: { type: 'string' }, description: 'מזהי משימות מסוימים (מתוך read_tasks)' },
    space: { type: 'string', description: 'שם מרחב (רלוונטי רק כשהטווח הוא כל המרחבים)' },
    status: { type: 'array', items: { type: 'string', enum: STA } },
    priority: { type: 'array', items: { type: 'string', enum: PRI } },
    overdue: { type: 'boolean', description: 'true = משימות באיחור (תאריך יעד לפני היום, לא הושלמו)' },
    due_on: { type: 'string', description: 'YYYY-MM-DD' },
    due_before: { type: 'string', description: 'YYYY-MM-DD (לפני תאריך זה)' },
    due_after: { type: 'string', description: 'YYYY-MM-DD (אחרי תאריך זה)' },
    no_due_date: { type: 'boolean', description: 'true = רק משימות ללא תאריך יעד' },
    search: { type: 'string', description: 'חיפוש טקסט בכותרת או בתיאור' },
  },
  additionalProperties: false,
};

export const TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'read_tasks',
      description: 'קריאת משימות בטווח העבודה הנוכחי, עם סינון אופציונלי. מחזיר רשימת משימות.',
      parameters: { type: 'object', properties: { filter: filterSchema }, additionalProperties: false },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'add_tasks',
      description: 'הוספת משימה אחת או יותר. כשהטווח הוא כל המרחבים חובה לציין מרחב לכל משימה (אלא אם יש מרחב אחד בלבד).',
      parameters: {
        type: 'object',
        properties: {
          tasks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                space: { type: 'string', description: 'שם המרחב' },
                description: { type: 'string' },
                priority: { type: 'string', enum: PRI },
                status: { type: 'string', enum: STA },
                due_date: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
              },
              required: ['title'],
              additionalProperties: false,
            },
          },
        },
        required: ['tasks'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'update_tasks',
      description: 'עדכון משימות שמתאימות לסינון: סטטוס, עדיפות, תאריך יעד, כותרת, תיאור או מעבר למרחב אחר. מעדכן את כל המשימות שמתאימות לסינון.',
      parameters: {
        type: 'object',
        properties: {
          filter: filterSchema,
          changes: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
              priority: { type: 'string', enum: PRI },
              status: { type: 'string', enum: STA },
              due_date: { type: ['string', 'null'], description: 'YYYY-MM-DD, או null כדי לנקות את התאריך' },
              space: { type: 'string', description: 'העברה למרחב אחר (בשם)' },
            },
            additionalProperties: false,
          },
        },
        required: ['filter', 'changes'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'delete_tasks',
      description: 'מחיקת משימות שמתאימות לסינון. פעולה בלתי הפיכה — המערכת תבקש מהמשתמש אישור לפני ביצוע.',
      parameters: { type: 'object', properties: { filter: filterSchema }, required: ['filter'], additionalProperties: false },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'summarize_tasks',
      description: 'סיכום סטטיסטי של המשימות בטווח: כמה פתוחות, באיחור, דחופות, להיום, הושלמו השבוע, והמשימות החשובות ביותר.',
      parameters: { type: 'object', properties: { filter: filterSchema }, additionalProperties: false },
    },
  },
];

type Ctx = { spaces: Space[]; scopeSpaces: Space[]; scope: Scope; today: string };

export async function buildCtx(scope: Scope): Promise<Ctx> {
  const spaces = await listSpaces();
  let scopeSpaces = spaces;
  if (scope.mode === 'space') {
    scopeSpaces = spaces.filter((s) => s.id === scope.spaceId);
    if (!scopeSpaces.length) throw new Error('המרחב שנבחר לא קיים');
  }
  return { spaces, scopeSpaces, scope, today: todayIL() };
}

function resolveSpace(ctx: Ctx, name?: string): { space?: Space; error?: string } {
  if (ctx.scope.mode === 'space') {
    const only = ctx.scopeSpaces[0];
    if (name) {
      const n = name.trim().toLowerCase();
      if (n && !only.name.toLowerCase().includes(n) && !n.includes(only.name.toLowerCase())) {
        return { error: `הטווח הנוכחי הוא המרחב "${only.name}" בלבד. אי אפשר לפעול על "${name}".` };
      }
    }
    return { space: only };
  }
  if (!name || !name.trim()) {
    if (ctx.scopeSpaces.length === 1) return { space: ctx.scopeSpaces[0] };
    return { error: `לא צוין מרחב. המרחבים הקיימים: ${ctx.scopeSpaces.map((s) => s.name).join(', ')}` };
  }
  const n = name.trim().toLowerCase();
  const exact = ctx.scopeSpaces.find((s) => s.name.toLowerCase() === n);
  const fuzzy = exact ?? ctx.scopeSpaces.find((s) => s.name.toLowerCase().includes(n) || n.includes(s.name.toLowerCase()));
  if (!fuzzy) return { error: `המרחב "${name}" לא נמצא. המרחבים הקיימים: ${ctx.scopeSpaces.map((s) => s.name).join(', ')}` };
  return { space: fuzzy };
}

async function selectTasks(ctx: Ctx, f: any = {}): Promise<{ tasks: Task[]; error?: string }> {
  let ids = ctx.scopeSpaces.map((s) => s.id);
  if (f.space) {
    const r = resolveSpace(ctx, f.space);
    if (r.error) return { tasks: [], error: r.error };
    ids = [r.space!.id];
  }
  let tasks = await listTasks(ids);
  if (Array.isArray(f.ids) && f.ids.length) tasks = tasks.filter((t) => f.ids.includes(t.id));
  if (Array.isArray(f.status) && f.status.length) tasks = tasks.filter((t) => f.status.includes(t.status));
  if (Array.isArray(f.priority) && f.priority.length) tasks = tasks.filter((t) => f.priority.includes(t.priority));
  if (f.overdue) tasks = tasks.filter((t) => t.due_date && t.due_date < ctx.today && t.status !== 'done');
  if (f.due_on) tasks = tasks.filter((t) => t.due_date === f.due_on);
  if (f.due_before) tasks = tasks.filter((t) => t.due_date && t.due_date < f.due_before);
  if (f.due_after) tasks = tasks.filter((t) => t.due_date && t.due_date > f.due_after);
  if (f.no_due_date) tasks = tasks.filter((t) => !t.due_date);
  if (f.search) {
    const s = String(f.search).toLowerCase();
    tasks = tasks.filter((t) => t.title.toLowerCase().includes(s) || t.description.toLowerCase().includes(s));
  }
  return { tasks };
}

const spaceName = (ctx: Ctx, id: string) => ctx.spaces.find((s) => s.id === id)?.name ?? '';
const brief = (ctx: Ctx, t: Task) => ({
  id: t.id,
  title: t.title,
  space: spaceName(ctx, t.space_id),
  priority: PRIORITY_MAP[t.priority].label,
  status: STATUS_MAP[t.status].label,
  due_date: t.due_date,
});

function cleanChanges(ctx: Ctx, c: any = {}): { patch: any; error?: string } {
  const patch: any = {};
  if (c.title !== undefined) patch.title = c.title;
  if (c.description !== undefined) patch.description = c.description;
  if (c.priority !== undefined) { if (!isPriority(c.priority)) return { patch, error: 'עדיפות לא חוקית' }; patch.priority = c.priority; }
  if (c.status !== undefined) { if (!isStatus(c.status)) return { patch, error: 'סטטוס לא חוקי' }; patch.status = c.status; }
  if (c.due_date !== undefined) {
    if (c.due_date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(c.due_date)) return { patch, error: 'תאריך לא חוקי' };
    patch.due_date = c.due_date;
  }
  if (c.space) {
    if (ctx.scope.mode === 'space') return { patch, error: 'אי אפשר להעביר משימות מחוץ למרחב הנוכחי' };
    const r = resolveSpace(ctx, c.space);
    if (r.error) return { patch, error: r.error };
    patch.space_id = r.space!.id;
  }
  return { patch };
}

/** Which tasks would actually change? (dry-run, used for the confirmation threshold) */
export async function dryRun(call: ToolCall, ctx: Ctx): Promise<{ count: number; label: string; error?: string }> {
  const a = call.args ?? {};
  if (call.name === 'add_tasks') {
    const n = Array.isArray(a.tasks) ? a.tasks.length : 0;
    return { count: n, label: `הוספת ${n} משימות` };
  }
  if (call.name === 'delete_tasks') {
    const { tasks, error } = await selectTasks(ctx, a.filter);
    return { count: tasks.length, label: `מחיקת ${tasks.length} משימות`, error };
  }
  if (call.name === 'update_tasks') {
    const { tasks, error } = await selectTasks(ctx, a.filter);
    const { patch, error: e2 } = cleanChanges(ctx, a.changes);
    if (error || e2) return { count: 0, label: '', error: error || e2 };
    const changed = tasks.filter((t) => Object.keys(patch).some((k) => (patch as any)[k] !== (t as any)[k] && !(k === 'due_date' && patch[k] == null && t.due_date == null)));
    return { count: changed.length, label: `עדכון ${changed.length} משימות (${describeChanges(ctx, patch)})` };
  }
  return { count: 0, label: '' };
}

export function describeChanges(ctx: Ctx, p: any) {
  const parts: string[] = [];
  if (p.status) parts.push(`סטטוס ← ${STATUS_MAP[p.status as keyof typeof STATUS_MAP].label}`);
  if (p.priority) parts.push(`עדיפות ← ${PRIORITY_MAP[p.priority as keyof typeof PRIORITY_MAP].label}`);
  if (p.due_date !== undefined) parts.push(p.due_date ? `תאריך יעד ← ${p.due_date}` : 'מחיקת תאריך יעד');
  if (p.title) parts.push('שינוי כותרת');
  if (p.description !== undefined) parts.push('שינוי תיאור');
  if (p.space_id) parts.push(`מרחב ← ${spaceName(ctx, p.space_id)}`);
  return parts.join(', ');
}

export async function executeTool(call: ToolCall, ctx: Ctx): Promise<ToolResult> {
  const a = call.args ?? {};
  try {
    switch (call.name) {
      case 'read_tasks': {
        const { tasks, error } = await selectTasks(ctx, a.filter);
        if (error) return { ok: false, affected: 0, message: error };
        const shown = tasks.slice(0, 100).map((t) => brief(ctx, t));
        return { ok: true, affected: 0, message: `נמצאו ${tasks.length} משימות`, data: { today: ctx.today, count: tasks.length, truncated: tasks.length > 100, tasks: shown } };
      }
      case 'summarize_tasks': {
        const { tasks, error } = await selectTasks(ctx, a.filter);
        if (error) return { ok: false, affected: 0, message: error };
        const open = tasks.filter((t) => t.status !== 'done');
        const ws = weekStart(ctx.today);
        const doneWeek = tasks.filter((t) => t.status === 'done' && t.completed_at && new Date(t.completed_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }) >= ws);
        const rank = (t: Task) => PRIORITY_MAP[t.priority].rank;
        const top = [...open]
          .sort((x, y) => rank(y) - rank(x) || (x.due_date ?? '9999').localeCompare(y.due_date ?? '9999'))
          .slice(0, 6)
          .map((t) => brief(ctx, t));
        const by = (keys: string[], get: (t: Task) => string, labels: (k: string) => string) =>
          Object.fromEntries(keys.map((k) => [labels(k), tasks.filter((t) => get(t) === k).length]));
        return {
          ok: true,
          affected: 0,
          message: 'סיכום',
          data: {
            today: ctx.today,
            scope: ctx.scopeSpaces.map((s) => s.name),
            total: tasks.length,
            open: open.length,
            overdue: open.filter((t) => t.due_date && t.due_date < ctx.today).length,
            due_today: open.filter((t) => t.due_date === ctx.today).length,
            urgent_open: open.filter((t) => t.priority === 'urgent').length,
            done_this_week: doneWeek.length,
            by_status: by(STA, (t) => t.status, (k) => STATUS_MAP[k as keyof typeof STATUS_MAP].label),
            by_priority: by(PRI, (t) => t.priority, (k) => PRIORITY_MAP[k as keyof typeof PRIORITY_MAP].label),
            top_priorities: top,
          },
        };
      }
      case 'add_tasks': {
        const items: any[] = Array.isArray(a.tasks) ? a.tasks : [];
        if (!items.length) return { ok: false, affected: 0, message: 'לא התקבלו משימות להוספה' };
        const created: Task[] = [];
        for (const it of items) {
          const r = resolveSpace(ctx, it.space);
          if (r.error) return { ok: false, affected: created.length, message: r.error };
          const t = await createTask({
            space_id: r.space!.id,
            title: it.title,
            description: it.description,
            priority: it.priority,
            status: it.status,
            due_date: it.due_date ?? null,
          });
          created.push(t);
        }
        return { ok: true, affected: created.length, message: `נוספו ${created.length} משימות`, data: created.map((t) => brief(ctx, t)) };
      }
      case 'update_tasks': {
        const { tasks, error } = await selectTasks(ctx, a.filter);
        if (error) return { ok: false, affected: 0, message: error };
        const { patch, error: e2 } = cleanChanges(ctx, a.changes);
        if (e2) return { ok: false, affected: 0, message: e2 };
        if (!Object.keys(patch).length) return { ok: false, affected: 0, message: 'לא צוין מה לעדכן' };
        let n = 0;
        for (const t of tasks) {
          const differs = Object.keys(patch).some((k) => (patch as any)[k] !== (t as any)[k] && !(k === 'due_date' && patch[k] == null && t.due_date == null));
          if (!differs) continue;
          await updateTask(t.id, patch);
          n++;
        }
        return { ok: true, affected: n, message: n ? `עודכנו ${n} משימות (${describeChanges(ctx, patch)})` : 'לא נמצאו משימות לעדכון', data: { updated: n } };
      }
      case 'delete_tasks': {
        const { tasks, error } = await selectTasks(ctx, a.filter);
        if (error) return { ok: false, affected: 0, message: error };
        await deleteTasks(tasks.map((t) => t.id));
        return { ok: true, affected: tasks.length, message: tasks.length ? `נמחקו ${tasks.length} משימות` : 'לא נמצאו משימות למחיקה', data: { deleted: tasks.length } };
      }
      default:
        return { ok: false, affected: 0, message: `כלי לא מוכר: ${call.name}` };
    }
  } catch (e: any) {
    return { ok: false, affected: 0, message: `שגיאה: ${e.message}` };
  }
}

export function systemPrompt(ctx: Ctx) {
  const scopeText =
    ctx.scope.mode === 'all'
      ? `כל המרחבים (${ctx.spaces.map((s) => `"${s.name}"`).join(', ') || 'אין מרחבים'})`
      : `המרחב "${ctx.scopeSpaces[0].name}" בלבד`;
  const d = new Date(ctx.today + 'T12:00:00Z');
  const wd = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'][d.getUTCDay()];
  return `אתה עוזר חכם בתוך מערכת לניהול משימות בעברית. תפקידך לענות על שאלות ולבצע פעולות על המשימות של המשתמש.

הקשר:
- התאריך היום: ${ctx.today} (יום ${wd}), אזור זמן ישראל. "מחר" = ${addDays(ctx.today, 1)}. שבוע מתחיל ביום ראשון.
- טווח העבודה הנוכחי: ${scopeText}. אתה פועל אך ורק על הטווח הזה. אל תנסה לגעת במשימות או במרחבים מחוצה לו.
- עדיפויות: נמוכה, בינונית, גבוהה, דחוף. סטטוסים: חדשה (new), בעבודה (in_progress), בהשהייה (paused), הושלמה (done).

כללים:
1. השתמש בכלים כדי לקרוא ולשנות משימות; לעולם אל תמציא משימות או נתונים. לשאלות על המצב — קרא קודם (read_tasks / summarize_tasks).
2. תאריכים בכלים בפורמט YYYY-MM-DD. חשב תאריכים יחסיים ("מחר", "ב-10 לחודש", "יום שישי הקרוב") מהתאריך של היום.
3. אל תבקש אישור בעצמך לפני מחיקה או פעולה על יותר מ-3 משימות — פשוט קרא לכלי. המערכת עצמה עוצרת, מציגה למשתמש כפתורי אישור/ביטול ומבצעת רק אחרי אישור.
4. כשהטווח הוא כל המרחבים והמשתמש לא ציין לאיזה מרחב להוסיף משימה — שאל אותו. כשהוא ציין מרחב, השתמש בשמו.
5. אחרי כל פעולה ענה בעברית קצרה (משפט או שניים) מה עשית. בשאלות על עדיפויות — תן המלצה קצרה ומנומקת של עד 5 משימות.
6. אל תשתמש בעיצוב כבד; טקסט פשוט, אפשר רשימה קצרה עם מקפים.`;
}
