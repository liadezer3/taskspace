'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { StoreProvider, useStore } from './Store';
import Modals from './Modals';
import AgentWidget from './AgentWidget';
import { SpaceDot } from './ui';

function Nav() {
  const { spaces, setModal } = useStore();
  const path = usePathname();
  const router = useRouter();
  const logout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };
  return (
    <header className="nav">
      <Link href="/" className="brand">
        <span className="logo">✓</span>
        <span>מרחב משימות</span>
      </Link>
      <nav className="pills">
        <Link href="/" className={'pill' + (path === '/' ? ' active' : '')}>דשבורד</Link>
        {spaces.map((s) => {
          const active = path === `/space/${s.id}`;
          return (
            <Link key={s.id} href={`/space/${s.id}`} className={'pill' + (active ? ' active' : '')} style={active ? { background: s.color + '1f', color: s.color, borderColor: s.color + '55' } : undefined}>
              <SpaceDot color={s.color} />
              {s.name}
            </Link>
          );
        })}
        <button className="pill add" onClick={() => setModal({ type: 'space' })}>＋ מרחב חדש</button>
      </nav>
      <button className="btn ghost small" onClick={logout}>יציאה</button>
    </header>
  );
}

function Inner({ children }: { children: React.ReactNode }) {
  const { error } = useStore();
  return (
    <>
      <Nav />
      {error && <div className="toast-err">{error}</div>}
      <main className="main">{children}</main>
      <Modals />
      <AgentWidget />
    </>
  );
}

export default function Shell({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider>
      <Inner>{children}</Inner>
    </StoreProvider>
  );
}
