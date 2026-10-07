'use client';
import { useState } from 'react';
import { PRIORITIES, PRIORITY_MAP, Space, Task } from '@/lib/constants';
import { useStore } from '../Store';
import { DueLabel, StatusBadge } from '../ui';

export default function Todo({ space, tasks }: { space: Space; tasks: Task[] }) {
  const { patchTask, addTask, setModal } = useStore();
  const [showDone, setShowDone] = useState(false);
  const [quick, setQuick] = useState('');

  const open = tasks.filter((t) => t.status !== 'done');
  const done = tasks.filter((t) => t.status === 'done');
  const sorted = (l: Task[]) =>
    [...l].sort((a, b) => PRIORITY_MAP[b.priority].rank - PRIORITY_MAP[a.priority].rank || (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999') || a.position - b.position);

  const row = (t: Task) => (
    <li key={t.id} className={'trow' + (t.status === 'done' ? ' done' : '')} style={{ borderInlineStartColor: PRIORITY_MAP[t.priority].color }}>
      <button
        className={'check' + (t.status === 'done' ? ' on' : '')}
        aria-label={t.status === 'done' ? 'החזרה לפתוחה' : 'סימון כהושלמה'}
        onClick={() => patchTask(t.id, { status: t.status === 'done' ? 'new' : 'done' })}
      >
        {t.status === 'done' ? '✓' : ''}
      </button>
      <button className="ttitle" onClick={() => setModal({ type: 'task', id: t.id })}>{t.title}</button>
      <span className="tmeta">
        {t.status !== 'new' && t.status !== 'done' && <StatusBadge s={t.status} />}
        <DueLabel t={t} />
      </span>
    </li>
  );

  const submitQuick = async () => {
    const title = quick.trim();
    if (!title) return;
    setQuick('');
    await addTask({ space_id: space.id, title });
  };

  return (
    <div className="todo">
      <div className="quickadd">
        <input className="input" placeholder="הוספה מהירה — הקלידו משימה ולחצו Enter" value={quick} onChange={(e) => setQuick(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submitQuick()} />
      </div>
      {PRIORITIES.slice().reverse().map((p) => {
        const items = sorted(open.filter((t) => t.priority === p.key));
        if (!items.length) return null;
        return (
          <section key={p.key} className="tgroup">
            <h3 style={{ color: p.color }}><i style={{ background: p.color }} />{p.label} <span className="count">{items.length}</span></h3>
            <ul>{items.map(row)}</ul>
          </section>
        );
      })}
      {!open.length && <div className="empty-big">אין משימות פתוחות 🎉</div>}
      {done.length > 0 && (
        <section className="tgroup">
          <button className="done-toggle" onClick={() => setShowDone((v) => !v)}>
            {showDone ? '▾' : '◂'} הושלמו <span className="count">{done.length}</span>
          </button>
          {showDone && <ul>{sorted(done).map(row)}</ul>}
        </section>
      )}
    </div>
  );
}
