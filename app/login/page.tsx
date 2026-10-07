'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Login() {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setErr('');
    const r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) });
    if (r.ok) { router.push('/'); router.refresh(); return; }
    const j = await r.json().catch(() => ({}));
    setErr(j.error || 'שגיאה'); setBusy(false);
  };

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <span className="logo big">✓</span>
        <h1>מרחב משימות</h1>
        <p>הזינו את הסיסמה כדי להיכנס</p>
        <input className="input" type="password" autoFocus placeholder="סיסמה" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" />
        {err && <div className="form-err">{err}</div>}
        <button className="btn primary wide" disabled={!pw || busy}>{busy ? 'נכנס…' : 'כניסה'}</button>
      </form>
    </div>
  );
}
