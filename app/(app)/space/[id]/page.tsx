'use client';
import { use } from 'react';
import { VIEWS } from '@/lib/constants';
import { useStore } from '@/components/Store';
import Kanban from '@/components/views/Kanban';
import Todo from '@/components/views/Todo';
import Calendar from '@/components/views/Calendar';
import { SpaceDot } from '@/components/ui';

export default function SpacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { spaces, tasks, loaded, patchSpace, setModal } = useStore();
  const space = spaces.find((s) => s.id === id);
  if (!loaded) return <div className="loading">טוען…</div>;
  if (!space) return <div className="empty-big">המרחב לא נמצא.</div>;
  const mine = tasks.filter((t) => t.space_id === id);
  const open = mine.filter((t) => t.status !== 'done').length;

  return (
    <div className="space-page" style={{ ['--space' as any]: space.color }}>
      <div className="page-head">
        <div className="sp-title">
          <SpaceDot color={space.color} size={16} />
          <h1>{space.name}</h1>
          <span className="count">{open} פתוחות</span>
          <button className="icon-btn" title="הגדרות מרחב" onClick={() => setModal({ type: 'space', id: space.id })}>⚙</button>
        </div>
        <div className="head-actions">
          <div className="seg view-switch" role="group" aria-label="תצוגה">
            {VIEWS.map((v) => (
              <button key={v.key} className={space.view === v.key ? 'on' : ''} style={space.view === v.key ? { background: space.color, borderColor: space.color, color: '#fff' } : undefined} onClick={() => patchSpace(space.id, { view: v.key })}>
                <span aria-hidden>{v.icon}</span> {v.label}
              </button>
            ))}
          </div>
          <button className="btn primary" style={{ background: space.color, borderColor: space.color }} onClick={() => setModal({ type: 'new', defaults: { space_id: space.id } })}>＋ משימה חדשה</button>
        </div>
      </div>
      {space.view === 'kanban' && <Kanban space={space} tasks={mine} />}
      {space.view === 'todo' && <Todo space={space} tasks={mine} />}
      {space.view === 'calendar' && <Calendar space={space} tasks={mine} />}
    </div>
  );
}
