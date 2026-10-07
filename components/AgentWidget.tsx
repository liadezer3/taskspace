'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useStore } from './Store';
import { SpaceDot } from './ui';

type Scope = { mode: 'all' } | { mode: 'space'; spaceId: string };
type Pending = { calls: any[]; count: number; lines: string[] };
type Msg = {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  scopeLabel?: string;
  pending?: Pending;
  scope?: Scope;
  resolved?: 'approved' | 'denied';
  error?: boolean;
};

const SUGGESTIONS = ['מה המשימות הכי חשובות שצריך לתת להן עדיפות?', 'סכם לי את המצב', 'תדחה את כל מה שבאיחור למחר'];

export default function AgentWidget() {
  const { spaces, refresh } = useStore();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const [override, setOverride] = useState<Scope | null>(null);
  const idRef = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Auto scope from the current page; clicking the chip overrides until navigation
  const auto: Scope = useMemo(() => {
    const m = path.match(/^\/space\/([^/]+)/);
    return m && spaces.some((s) => s.id === m[1]) ? { mode: 'space', spaceId: m[1] } : { mode: 'all' };
  }, [path, spaces]);
  useEffect(() => setOverride(null), [path]);
  const scope: Scope = override && (override.mode === 'all' || spaces.some((s) => s.id === override.spaceId)) ? override : auto;
  const scopeSpace = scope.mode === 'space' ? spaces.find((s) => s.id === scope.spaceId) : undefined;
  const labelOf = (sc: Scope) => (sc.mode === 'all' ? 'כל המרחבים' : spaces.find((s) => s.id === sc.spaceId)?.name ?? 'מרחב');

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [msgs, busy, open]);
  useEffect(() => { if (open) setTimeout(() => taRef.current?.focus(), 150); }, [open]);

  const push = (m: Omit<Msg, 'id'>) => setMsgs((p) => [...p, { ...m, id: idRef.current++ }]);

  const send = async (raw?: string) => {
    const content = (raw ?? text).trim();
    if (!content || busy) return;
    setText('');
    const userMsg: Msg = { id: idRef.current++, role: 'user', content, scopeLabel: labelOf(scope) };
    const history = [...msgs, userMsg];
    setMsgs(history);
    setBusy(true);
    try {
      const r = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.filter((m) => !m.error).map((m) => ({ role: m.role, content: m.content })), scope }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401) { window.location.href = '/login'; return; }
      if (!r.ok) throw new Error(j.error || 'שגיאה');
      push({ role: 'assistant', content: j.reply, pending: j.pending, scope });
      if (j.mutated) refresh();
    } catch (e: any) {
      push({ role: 'assistant', content: `לא הצלחתי לענות: ${e.message}`, error: true });
    } finally {
      setBusy(false);
    }
  };

  const decide = async (m: Msg, approve: boolean) => {
    if (!m.pending || m.resolved || busy) return;
    setMsgs((p) => p.map((x) => (x.id === m.id ? { ...x, resolved: approve ? 'approved' : 'denied' } : x)));
    if (!approve) { push({ role: 'assistant', content: 'בסדר, לא ביצעתי שום שינוי.' }); return; }
    setBusy(true);
    try {
      const r = await fetch('/api/agent/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ calls: m.pending.calls, scope: m.scope ?? scope }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'שגיאה');
      push({ role: 'assistant', content: j.reply });
      if (j.mutated) refresh();
    } catch (e: any) {
      push({ role: 'assistant', content: `הפעולה נכשלה: ${e.message}`, error: true });
    } finally {
      setBusy(false);
    }
  };

  const hasPending = msgs.some((m) => m.pending && !m.resolved);

  return (
    <>
      {!open && (
        <button className="fab" onClick={() => setOpen(true)} aria-label="שיחה עם הסוכן החכם">
          <span className="fab-icon">✦</span>
          <span className="fab-label">שאלו את הסוכן</span>
        </button>
      )}
      {open && (
        <aside className="chat" role="dialog" aria-label="סוכן חכם">
          <header className="chat-head">
            <div className="chat-title">
              <span className="avatar">✦</span>
              <div>
                <b>העוזר החכם</b>
                <small><i className="online" /> מחובר</small>
              </div>
            </div>
            <div className="chat-actions">
              {msgs.length > 0 && <button className="icon-btn" title="שיחה חדשה" onClick={() => setMsgs([])}>↺</button>}
              <button className="icon-btn" onClick={() => setOpen(false)} aria-label="סגירה">✕</button>
            </div>
          </header>

          <div className="scope-bar">
            <span>עובד עכשיו על:</span>
            <div className="scope-wrap">
              <button className="scope-chip" onClick={() => setMenu((v) => !v)} style={scopeSpace ? { borderColor: scopeSpace.color, color: scopeSpace.color, background: scopeSpace.color + '14' } : undefined}>
                {scopeSpace ? <SpaceDot color={scopeSpace.color} size={9} /> : <span>◎</span>}
                {labelOf(scope)} <small>▾</small>
              </button>
              {menu && (
                <div className="scope-menu" onMouseLeave={() => setMenu(false)}>
                  <button className={scope.mode === 'all' ? 'on' : ''} onClick={() => { setOverride({ mode: 'all' }); setMenu(false); }}>◎ כל המרחבים</button>
                  {spaces.map((s) => (
                    <button key={s.id} className={scope.mode === 'space' && scope.spaceId === s.id ? 'on' : ''} onClick={() => { setOverride({ mode: 'space', spaceId: s.id }); setMenu(false); }}>
                      <SpaceDot color={s.color} size={9} /> {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="chat-body">
            {!msgs.length && (
              <div className="welcome">
                <span className="avatar big">✦</span>
                <h3>היי, איך אפשר לעזור?</h3>
                <p>אפשר לשאול על המשימות שלכם או לבקש ממני לבצע פעולות: להוסיף, לעדכן, למחוק ולסכם.</p>
                <div className="sugs">
                  {SUGGESTIONS.map((s) => <button key={s} onClick={() => send(s)}>{s}</button>)}
                </div>
              </div>
            )}
            {msgs.map((m) => (
              <div key={m.id} className={'msg ' + m.role + (m.error ? ' err' : '')}>
                <div className="bubble">{m.content}</div>
                {m.role === 'user' && m.scopeLabel && <small className="msg-scope">נשלח עם: {m.scopeLabel}</small>}
                {m.pending && (
                  <div className={'confirm' + (m.resolved ? ' resolved' : '')}>
                    <div className="confirm-title">⚠ נדרש אישור · {m.pending.count} משימות</div>
                    {m.resolved ? (
                      <div className="confirm-state">{m.resolved === 'approved' ? '✓ אושר' : '✕ לא אושר'}</div>
                    ) : (
                      <div className="confirm-btns">
                        <button className="btn primary" onClick={() => decide(m, true)} disabled={busy}>אישור</button>
                        <button className="btn" onClick={() => decide(m, false)} disabled={busy}>ביטול</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {busy && <div className="msg assistant"><div className="bubble typing"><i /><i /><i /></div></div>}
            <div ref={endRef} />
          </div>

          <form className="composer" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <textarea
              ref={taRef}
              rows={1}
              placeholder={hasPending ? 'אשרו או בטלו, או כתבו הודעה…' : 'כתבו הודעה…'}
              value={text}
              onChange={(e) => { setText(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            />
            <button className="send" disabled={!text.trim() || busy} aria-label="שליחה">➤</button>
          </form>
        </aside>
      )}
    </>
  );
}
