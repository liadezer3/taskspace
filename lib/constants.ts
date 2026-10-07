export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type Status = 'new' | 'in_progress' | 'paused' | 'done';
export type ViewType = 'kanban' | 'todo' | 'calendar';

export type Space = { id: string; name: string; color: string; view: ViewType; position: number };
export type Task = {
  id: string;
  space_id: string;
  title: string;
  description: string;
  priority: Priority;
  status: Status;
  due_date: string | null;
  completed_at: string | null;
  position: number;
  created_at: string;
  updated_at: string;
};

export const PRIORITIES: { key: Priority; label: string; color: string; rank: number }[] = [
  { key: 'low', label: 'נמוכה', color: '#64748b', rank: 1 },
  { key: 'medium', label: 'בינונית', color: '#3b82f6', rank: 2 },
  { key: 'high', label: 'גבוהה', color: '#f97316', rank: 3 },
  { key: 'urgent', label: 'דחוף', color: '#ef4444', rank: 4 },
];

export const STATUSES: { key: Status; label: string; color: string }[] = [
  { key: 'new', label: 'חדשה', color: '#0ea5e9' },
  { key: 'in_progress', label: 'בעבודה', color: '#8b5cf6' },
  { key: 'paused', label: 'בהשהייה', color: '#d97706' },
  { key: 'done', label: 'הושלמה', color: '#16a34a' },
];

export const VIEWS: { key: ViewType; label: string; desc: string; icon: string }[] = [
  { key: 'kanban', label: 'קנבן', desc: 'עמודות לפי סטטוס, גרירה ושחרור', icon: '▥' },
  { key: 'todo', label: 'רשימת TODO', desc: 'רשימה עם וי, ממוינת לפי עדיפות', icon: '☑' },
  { key: 'calendar', label: 'לוח שנה', desc: 'חודש שלם לפי תאריך יעד', icon: '▦' },
];

export const SPACE_COLORS = [
  '#6366f1', '#0ea5e9', '#14b8a6', '#22c55e', '#eab308',
  '#f97316', '#ef4444', '#ec4899', '#a855f7', '#64748b',
];

export const PRIORITY_MAP = Object.fromEntries(PRIORITIES.map((p) => [p.key, p])) as Record<Priority, (typeof PRIORITIES)[number]>;
export const STATUS_MAP = Object.fromEntries(STATUSES.map((s) => [s.key, s])) as Record<Status, (typeof STATUSES)[number]>;

export const isPriority = (v: any): v is Priority => v in PRIORITY_MAP;
export const isStatus = (v: any): v is Status => v in STATUS_MAP;
export const isView = (v: any): v is ViewType => v === 'kanban' || v === 'todo' || v === 'calendar';
