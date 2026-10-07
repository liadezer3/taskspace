'use client';
import { useState } from 'react';
import { STATUSES, PRIORITY_MAP, Space, Status, Task } from '@/lib/constants';
import { useStore } from '../Store';
import { DueLabel, PriorityBadge } from '../ui';

export default function Kanban({ space, tasks }: { space: Space; tasks: Task[] }) {
  const { patchTask, setModal } = useStore();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<Status | null>(null);
  const [overCard, setOverCard] = useState<string | null>(null);

  const col = (s: Status) => tasks.filter((t) => t.status === s).sort((a, b) => a.position - b.position);

  const drop = (status: Status, beforeId: string | null) => {
    const id = dragId;
    setDragId(null); setOverCol(null); setOverCard(null);
    if (!id) return;
    const moving = tasks.find((t) => t.id === id);
    if (!moving) return;
    const list = col(status).filter((t) => t.id !== id);
    let pos: number;
    if (beforeId) {
      const idx = list.findIndex((t) => t.id === beforeId);
      const next = list[idx];
      const prev = list[idx - 1];
      pos = prev ? (prev.position + next.position) / 2 : next.position - 1000;
    } else {
      pos = list.length ? list[list.length - 1].position + 1000 : Math.max(0, ...tasks.map((t) => t.position)) + 1000;
    }
    if (moving.status === status && beforeId === null && list.length === col(status).length - 1 && col(status)[col(status).length - 1]?.id === id) return;
    patchTask(id, { status, position: pos });
  };

  return (
    <div className="kanban">
      {STATUSES.map((s) => {
        const items = col(s.key);
        return (
          <section
            key={s.key}
            className={'kcol' + (overCol === s.key ? ' over' : '')}
            onDragOver={(e) => { e.preventDefault(); setOverCol(s.key); }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverCol(null); }}
            onDrop={(e) => { e.preventDefault(); drop(s.key, null); }}
          >
            <header>
              <span className="kdot" style={{ background: s.color }} />
              <h3>{s.label}</h3>
              <span className="count">{items.length}</span>
            </header>
            <div className="kcards">
              {items.map((t) => (
                <article
                  key={t.id}
                  draggable
                  className={'kcard' + (dragId === t.id ? ' dragging' : '') + (overCard === t.id && dragId !== t.id ? ' drop-before' : '') + (t.status === 'done' ? ' done' : '')}
                  style={{ borderInlineStartColor: PRIORITY_MAP[t.priority].color }}
                  onDragStart={(e) => { setDragId(t.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', t.id); }}
                  onDragEnd={() => { setDragId(null); setOverCol(null); setOverCard(null); }}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setOverCard(t.id); setOverCol(s.key); }}
                  onDrop={(e) => { e.preventDefault(); e.stopPropagation(); drop(s.key, t.id); }}
                  onClick={() => setModal({ type: 'task', id: t.id })}
                >
                  <div className="ktitle">{t.title}</div>
                  <div className="kmeta">
                    <PriorityBadge p={t.priority} />
                    <DueLabel t={t} />
                  </div>
                </article>
              ))}
              {!items.length && <div className="kempty">גררו לכאן משימה</div>}
            </div>
            <button className="kadd" onClick={() => setModal({ type: 'new', defaults: { space_id: space.id, status: s.key } })}>＋ משימה</button>
          </section>
        );
      })}
    </div>
  );
}
