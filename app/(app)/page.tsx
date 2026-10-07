'use client';
import Link from 'next/link';
import { useMemo } from 'react';
import { PRIORITY_MAP, Task } from '@/lib/constants';
import { todayLocal, weekStart, ymd } from '@/lib/dates';
import { useStore } from '@/components/Store';
import { DueLabel, PriorityBadge, SpaceDot, SpaceTag, isOverdue } from '@/components/ui';

function localYmd(iso: string) {
  const d = new Date(iso);
  return ymd(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

export default function Dashboard() {
  const { spaces, tasks, loaded, dashSel, setDashSel, setModal } = useStore();
  const today = todayLocal();
  const ws = weekStart(today);

  const sel = useMemo(() => {
    const ids = dashSel ? dashSel.filter((id) => spaces.some((s) => s.id === id)) : spaces.map((s) => s.id);
    return new Set(ids);
  }, [dashSel, spaces]);
  const allSelected = sel.size === spaces.length;

  const toggle = (id: string) => {
    const next = new Set(sel);
    next.has(id) ? next.delete(id) : next.add(id);
    setDashSel(next.size === spaces.length ? null : [...next]);
  };

  const mine = tasks.filter((t) => sel.has(t.space_id));
  const open = mine.filter((t) => t.status !== 'done');
  const rank = (t: Task) => PRIORITY_MAP[t.priority].rank;
  const byImportance = (a: Task, b: Task) => rank(b) - rank(a) || (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999');
  const urgent = open.filter((t) => t.priority === 'urgent').sort(byImportance);
  const dueToday = open.filter((t) => t.due_date === today).sort(byImportance);
  const overdue = open.filter((t) => isOverdue(t, today)).sort((a, b) => a.due_date!.localeCompare(b.due_date!));

  if (!loaded) return <div className="loading">טוען…</div>;

  if (!spaces.length) {
    return (
      <div className="empty-big">
        <p>עדיין אין מרחבים. צרו את הראשון כדי להתחיל.</p>
        <button className="btn primary" onClick={() => setModal({ type: 'space' })}>＋ מרחב חדש</button>
      </div>
    );
  }

  const list = (items: Task[], empty: string) =>
    items.length ? (
      <ul className="dlist">
        {items.map((t) => (
          <li key={t.id}>
            <button className="drow" style={{ borderInlineStartColor: PRIORITY_MAP[t.priority].color }} onClick={() => setModal({ type: 'task', id: t.id })}>
              <span className="dtitle">{t.title}</span>
              <span className="dmeta"><SpaceTag spaceId={t.space_id} /><PriorityBadge p={t.priority} /><DueLabel t={t} /></span>
            </button>
          </li>
        ))}
      </ul>
    ) : (
      <div className="dempty">{empty}</div>
    );

  return (
    <div className="dash">
      <div className="page-head">
        <div>
          <h1>הדשבורד שלי</h1>
          <p className="sub">מה חשוב עכשיו, מכל המרחבים שבחרתם</p>
        </div>
      </div>

      <div className="selector" role="group" aria-label="בחירת מרחבים להצגה">
        <span className="sel-label">מציגים:</span>
        <button className={'chip' + (allSelected ? ' on' : '')} onClick={() => setDashSel(null)}>הכל</button>
        {spaces.map((s) => {
          const on = sel.has(s.id);
          return (
            <button key={s.id} className={'chip' + (on ? ' on' : '')} style={on ? { background: s.color + '1f', borderColor: s.color, color: s.color } : undefined} onClick={() => toggle(s.id)}>
              <SpaceDot color={s.color} size={9} />
              {s.name}
            </button>
          );
        })}
      </div>

      <div className="panels">
        <section className="panel urgent">
          <h2><span className="ph-dot" style={{ background: PRIORITY_MAP.urgent.color }} />דחוף <span className="count">{urgent.length}</span></h2>
          {list(urgent, 'אין משימות דחופות 👌')}
        </section>
        <section className="panel">
          <h2><span className="ph-dot" style={{ background: '#3b82f6' }} />להיום <span className="count">{dueToday.length}</span></h2>
          {list(dueToday, 'אין משימות להיום')}
        </section>
        <section className="panel late">
          <h2><span className="ph-dot" style={{ background: '#dc2626' }} />באיחור <span className="count">{overdue.length}</span></h2>
          {list(overdue, 'אין משימות באיחור 🎉')}
        </section>
      </div>

      <h2 className="section-title">המרחבים שלי</h2>
      <div className="space-cards">
        {spaces.filter((s) => sel.has(s.id)).map((s) => {
          const st = tasks.filter((t) => t.space_id === s.id);
          const o = st.filter((t) => t.status !== 'done');
          const late = o.filter((t) => isOverdue(t, today)).length;
          const doneWeek = st.filter((t) => t.status === 'done' && t.completed_at && localYmd(t.completed_at) >= ws).length;
          return (
            <Link key={s.id} href={`/space/${s.id}`} className="scard" style={{ borderTopColor: s.color }}>
              <div className="scard-head"><SpaceDot color={s.color} size={12} /><b>{s.name}</b></div>
              <div className="stats">
                <div><strong>{o.length}</strong><span>פתוחות</span></div>
                <div className={late ? 'bad' : ''}><strong>{late}</strong><span>באיחור</span></div>
                <div className="good"><strong>{doneWeek}</strong><span>נסגרו השבוע</span></div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
