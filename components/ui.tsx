'use client';
import { PRIORITY_MAP, STATUS_MAP, Priority, Status, Task } from '@/lib/constants';
import { formatHe, todayLocal } from '@/lib/dates';
import { useStore } from './Store';

export function PriorityBadge({ p }: { p: Priority }) {
  const m = PRIORITY_MAP[p];
  return (
    <span className="badge" style={{ color: m.color, background: m.color + '1a' }}>
      <i style={{ background: m.color }} />
      {m.label}
    </span>
  );
}

export function StatusBadge({ s }: { s: Status }) {
  const m = STATUS_MAP[s];
  return (
    <span className="badge" style={{ color: m.color, background: m.color + '1a' }}>
      {m.label}
    </span>
  );
}

export function isOverdue(t: Task, today = todayLocal()) {
  return !!t.due_date && t.due_date < today && t.status !== 'done';
}

export function DueLabel({ t }: { t: Task }) {
  if (!t.due_date) return null;
  const today = todayLocal();
  const od = isOverdue(t, today);
  return <span className={'due' + (od ? ' overdue' : t.due_date === today ? ' today' : '')}>📅 {formatHe(t.due_date, today)}</span>;
}

export function SpaceDot({ color, size = 10 }: { color: string; size?: number }) {
  return <span className="sdot" style={{ background: color, width: size, height: size }} />;
}

export function SpaceTag({ spaceId }: { spaceId: string }) {
  const { spaces } = useStore();
  const s = spaces.find((x) => x.id === spaceId);
  if (!s) return null;
  return (
    <span className="spacetag">
      <SpaceDot color={s.color} size={8} />
      {s.name}
    </span>
  );
}
