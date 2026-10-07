'use client';
import { useMemo, useState } from 'react';
import { PRIORITY_MAP, Space, Task } from '@/lib/constants';
import { HE_DAYS, HE_MONTHS, addDays, todayLocal, weekdayIndex, ymd } from '@/lib/dates';
import { useStore } from '../Store';

export default function Calendar({ space, tasks }: { space: Space; tasks: Task[] }) {
  const { patchTask, setModal } = useStore();
  const today = todayLocal();
  const [cursor, setCursor] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) }));
  const [dragId, setDragId] = useState<string | null>(null);
  const [overDay, setOverDay] = useState<string | null>(null);

  const days = useMemo(() => {
    const first = ymd(cursor.y, cursor.m, 1);
    const start = addDays(first, -weekdayIndex(first));
    const lastDay = new Date(Date.UTC(cursor.y, cursor.m, 0)).getUTCDate();
    const last = ymd(cursor.y, cursor.m, lastDay);
    const end = addDays(last, 6 - weekdayIndex(last));
    const out: string[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
    return out;
  }, [cursor]);

  const byDay = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of tasks) if (t.due_date) (m.get(t.due_date) ?? m.set(t.due_date, []).get(t.due_date)!).push(t);
    for (const l of m.values()) l.sort((a, b) => PRIORITY_MAP[b.priority].rank - PRIORITY_MAP[a.priority].rank);
    return m;
  }, [tasks]);
  const undated = tasks.filter((t) => !t.due_date && t.status !== 'done');

  const move = (delta: number) => setCursor((c) => { const d = new Date(Date.UTC(c.y, c.m - 1 + delta, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 }; });

  const chip = (t: Task) => {
    const c = PRIORITY_MAP[t.priority].color;
    return (
      <button
        key={t.id}
        draggable
        className={'cchip' + (t.status === 'done' ? ' done' : '')}
        style={{ background: c + '22', color: c, borderInlineStartColor: c }}
        title={t.title}
        onDragStart={(e) => { setDragId(t.id); e.dataTransfer.setData('text/plain', t.id); e.dataTransfer.effectAllowed = 'move'; }}
        onDragEnd={() => { setDragId(null); setOverDay(null); }}
        onClick={(e) => { e.stopPropagation(); setModal({ type: 'task', id: t.id }); }}
      >
        <span>{t.title}</span>
      </button>
    );
  };

  return (
    <div className="cal">
      <div className="cal-head">
        <h2>{HE_MONTHS[cursor.m - 1]} {cursor.y}</h2>
        <div className="cal-nav">
          <button className="btn" onClick={() => setCursor({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) })}>היום</button>
          <button className="icon-btn round" onClick={() => move(-1)} aria-label="חודש קודם">›</button>
          <button className="icon-btn round" onClick={() => move(1)} aria-label="חודש הבא">‹</button>
        </div>
      </div>
      <div className="cal-grid">
        {HE_DAYS.map((d) => <div key={d} className="cal-dow">{d}</div>)}
        {days.map((d) => {
          const list = byDay.get(d) ?? [];
          const inMonth = Number(d.slice(5, 7)) === cursor.m;
          const shown = list.slice(0, 3);
          return (
            <div
              key={d}
              className={'cal-day' + (inMonth ? '' : ' out') + (d === today ? ' today' : '') + (overDay === d ? ' over' : '') + (weekdayIndex(d) === 6 ? ' sat' : '')}
              onClick={() => setModal({ type: 'new', defaults: { space_id: space.id, due_date: d } })}
              onDragOver={(e) => { e.preventDefault(); setOverDay(d); }}
              onDrop={(e) => { e.preventDefault(); const id = dragId; setDragId(null); setOverDay(null); if (id) patchTask(id, { due_date: d }); }}
            >
              <div className="cal-num"><span>{Number(d.slice(8, 10))}</span></div>
              {shown.map(chip)}
              {list.length > 3 && (
                <button className="cmore" onClick={(e) => { e.stopPropagation(); setModal({ type: 'day', date: d, spaceId: space.id }); }}>
                  +{list.length - 3} נוספות
                </button>
              )}
            </div>
          );
        })}
      </div>
      {undated.length > 0 && (
        <div className="undated">
          <b>ללא תאריך יעד ({undated.length}) — גררו ליום בלוח:</b>
          <div className="undated-list">{undated.map(chip)}</div>
        </div>
      )}
    </div>
  );
}
