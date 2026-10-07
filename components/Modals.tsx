'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PRIORITIES, SPACE_COLORS, STATUSES, VIEWS, Priority, Status, ViewType } from '@/lib/constants';
import { formatHe, todayLocal } from '@/lib/dates';
import { useStore } from './Store';
import { DueLabel, PriorityBadge, SpaceDot, StatusBadge } from './ui';

function Overlay({ children, onClose, wide }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'modal' + (wide ? ' wide' : '')} role="dialog" aria-modal="true">
        {children}
      </div>
    </div>
  );
}

function TaskModal() {
  const { modal, setModal, tasks, spaces, addTask, patchTask, removeTask } = useStore();
  const existing = modal?.type === 'task' ? tasks.find((t) => t.id === modal.id) : undefined;
  const defaults = modal?.type === 'new' ? modal.defaults : {};
  const [title, setTitle] = useState(existing?.title ?? defaults.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [priority, setPriority] = useState<Priority>(existing?.priority ?? defaults.priority ?? 'medium');
  const [status, setStatus] = useState<Status>(existing?.status ?? defaults.status ?? 'new');
  const [due, setDue] = useState<string>(existing?.due_date ?? defaults.due_date ?? '');
  const [spaceId, setSpaceId] = useState<string>(existing?.space_id ?? defaults.space_id ?? spaces[0]?.id ?? '');
  const [confirmDel, setConfirmDel] = useState(false);
  const [saving, setSaving] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const close = () => setModal(null);

  useEffect(() => { if (!existing) titleRef.current?.focus(); }, [existing]);

  if (modal?.type === 'task' && !existing) return null;
  const space = spaces.find((s) => s.id === spaceId);

  const save = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    const body = { title: title.trim(), description, priority, status, due_date: due || null, space_id: spaceId };
    if (existing) await patchTask(existing.id, body);
    else await addTask(body);
    setSaving(false);
    close();
  };

  return (
    <Overlay onClose={close}>
      <div className="modal-head" style={{ borderTopColor: space?.color }}>
        <h2>{existing ? 'עריכת משימה' : 'משימה חדשה'}</h2>
        <button className="icon-btn" onClick={close} aria-label="סגירה">✕</button>
      </div>
      <div className="modal-body">
        <input
          ref={titleRef}
          className="input title-input"
          placeholder="מה צריך לעשות?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          maxLength={300}
        />
        <textarea className="input" rows={3} placeholder="תיאור (אופציונלי)" value={description} onChange={(e) => setDescription(e.target.value)} />

        <label className="field-label">עדיפות</label>
        <div className="seg">
          {PRIORITIES.map((p) => (
            <button key={p.key} type="button" className={priority === p.key ? 'on' : ''} style={priority === p.key ? { background: p.color, borderColor: p.color, color: '#fff' } : { color: p.color }} onClick={() => setPriority(p.key)}>
              {p.label}
            </button>
          ))}
        </div>

        <label className="field-label">סטטוס</label>
        <div className="seg">
          {STATUSES.map((s) => (
            <button key={s.key} type="button" className={status === s.key ? 'on' : ''} style={status === s.key ? { background: s.color, borderColor: s.color, color: '#fff' } : { color: s.color }} onClick={() => setStatus(s.key)}>
              {s.label}
            </button>
          ))}
        </div>

        <div className="row2">
          <div>
            <label className="field-label">תאריך יעד</label>
            <div className="date-row">
              <input type="date" className="input" value={due} onChange={(e) => setDue(e.target.value)} />
              {due && <button type="button" className="link-btn" onClick={() => setDue('')}>נקה</button>}
            </div>
          </div>
          <div>
            <label className="field-label">מרחב</label>
            <select className="input" value={spaceId} onChange={(e) => setSpaceId(e.target.value)}>
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <div className="modal-foot">
        <button className="btn primary" onClick={save} disabled={!title.trim() || saving}>{existing ? 'שמירה' : 'יצירת משימה'}</button>
        <button className="btn" onClick={close}>ביטול</button>
        {existing && (
          <span className="spacer-end">
            {confirmDel ? (
              <>
                <button className="btn danger" onClick={async () => { await removeTask(existing.id); close(); }}>כן, למחוק</button>
                <button className="btn" onClick={() => setConfirmDel(false)}>לא</button>
              </>
            ) : (
              <button className="btn ghost-danger" onClick={() => setConfirmDel(true)}>מחיקה</button>
            )}
          </span>
        )}
      </div>
    </Overlay>
  );
}

function SpaceModal() {
  const { modal, setModal, spaces, addSpace, patchSpace, removeSpace } = useStore();
  const router = useRouter();
  const existing = modal?.type === 'space' && modal.id ? spaces.find((s) => s.id === modal.id) : undefined;
  const [name, setName] = useState(existing?.name ?? '');
  const [color, setColor] = useState(existing?.color ?? SPACE_COLORS[spaces.length % SPACE_COLORS.length]);
  const [view, setView] = useState<ViewType>(existing?.view ?? 'kanban');
  const [confirmDel, setConfirmDel] = useState(false);
  const close = () => setModal(null);

  const save = async () => {
    if (!name.trim()) return;
    if (existing) {
      await patchSpace(existing.id, { name: name.trim(), color, view });
      close();
    } else {
      const s = await addSpace({ name: name.trim(), color, view });
      close();
      if (s) router.push(`/space/${s.id}`);
    }
  };

  return (
    <Overlay onClose={close}>
      <div className="modal-head" style={{ borderTopColor: color }}>
        <h2>{existing ? 'הגדרות מרחב' : 'מרחב חדש'}</h2>
        <button className="icon-btn" onClick={close} aria-label="סגירה">✕</button>
      </div>
      <div className="modal-body">
        <label className="field-label">שם המרחב</label>
        <input className="input title-input" autoFocus placeholder="למשל: בית, עבודה, לימודים" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} maxLength={60} />

        <label className="field-label">צבע</label>
        <div className="swatches">
          {SPACE_COLORS.map((c) => (
            <button key={c} type="button" className={'swatch' + (c === color ? ' on' : '')} style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />
          ))}
        </div>

        <label className="field-label">תצוגה</label>
        <div className="view-cards">
          {VIEWS.map((v) => (
            <button key={v.key} type="button" className={'view-card' + (view === v.key ? ' on' : '')} style={view === v.key ? { borderColor: color, boxShadow: `0 0 0 3px ${color}22` } : undefined} onClick={() => setView(v.key)}>
              <span className="vc-icon" style={{ color }}>{v.icon}</span>
              <b>{v.label}</b>
              <small>{v.desc}</small>
            </button>
          ))}
        </div>
      </div>
      <div className="modal-foot">
        <button className="btn primary" onClick={save} disabled={!name.trim()}>{existing ? 'שמירה' : 'יצירת מרחב'}</button>
        <button className="btn" onClick={close}>ביטול</button>
        {existing && (
          <span className="spacer-end">
            {confirmDel ? (
              <>
                <button className="btn danger" onClick={async () => { const id = existing.id; close(); await removeSpace(id); router.push('/'); }}>כן, למחוק עם כל המשימות</button>
                <button className="btn" onClick={() => setConfirmDel(false)}>לא</button>
              </>
            ) : (
              <button className="btn ghost-danger" onClick={() => setConfirmDel(true)}>מחיקת מרחב</button>
            )}
          </span>
        )}
      </div>
    </Overlay>
  );
}

function DayModal() {
  const { modal, setModal, tasks } = useStore();
  if (modal?.type !== 'day') return null;
  const list = tasks.filter((t) => t.due_date === modal.date && t.space_id === modal.spaceId);
  return (
    <Overlay onClose={() => setModal(null)}>
      <div className="modal-head">
        <h2>{formatHe(modal.date, todayLocal())}</h2>
        <button className="icon-btn" onClick={() => setModal(null)} aria-label="סגירה">✕</button>
      </div>
      <div className="modal-body">
        {list.map((t) => (
          <button key={t.id} className="daytask" onClick={() => setModal({ type: 'task', id: t.id })}>
            <b className={t.status === 'done' ? 'strike' : ''}>{t.title}</b>
            <span><PriorityBadge p={t.priority} /> <StatusBadge s={t.status} /></span>
          </button>
        ))}
      </div>
      <div className="modal-foot">
        <button className="btn primary" onClick={() => setModal({ type: 'new', defaults: { due_date: modal.date, space_id: modal.spaceId } })}>＋ משימה חדשה ליום זה</button>
      </div>
    </Overlay>
  );
}

export default function Modals() {
  const { modal } = useStore();
  if (!modal) return null;
  const key = modal.type === 'task' ? 't' + modal.id : modal.type === 'space' ? 's' + (modal.id ?? 'new') : modal.type === 'day' ? 'd' + modal.date : 'new' + JSON.stringify(modal.defaults);
  if (modal.type === 'space') return <SpaceModal key={key} />;
  if (modal.type === 'day') return <DayModal key={key} />;
  return <TaskModal key={key} />;
}
