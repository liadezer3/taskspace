'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Space, Task, TaskInput0 } from './types';

type Modal =
  | { type: 'task'; id: string }
  | { type: 'new'; defaults: TaskInput0 }
  | { type: 'space'; id?: string }
  | { type: 'day'; date: string; spaceId: string }
  | null;

type Ctx = {
  spaces: Space[];
  tasks: Task[];
  loaded: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addTask: (input: TaskInput0 & { space_id: string }) => Promise<Task | null>;
  patchTask: (id: string, patch: Partial<Task>) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
  addSpace: (input: { name: string; color: string; view: string }) => Promise<Space | null>;
  patchSpace: (id: string, patch: Partial<Space>) => Promise<void>;
  removeSpace: (id: string) => Promise<void>;
  modal: Modal;
  setModal: (m: Modal) => void;
  dashSel: string[] | null; // null = all spaces
  setDashSel: (v: string[] | null) => void;
};

const C = createContext<Ctx>(null as any);
export const useStore = () => useContext(C);

async function api(url: string, method = 'GET', body?: any) {
  const r = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  if (r.status === 401) { window.location.href = '/login'; throw new Error('unauthorized'); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'שגיאה');
  return j;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [dashSel, setDashSelState] = useState<string[] | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [s, t] = await Promise.all([api('/api/spaces'), api('/api/tasks')]);
      setSpaces(s.spaces);
      setTasks(t.tasks);
      setError(null);
    } catch (e: any) {
      if (e.message !== 'unauthorized') setError(e.message || 'שגיאת טעינה');
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    refresh();
    try {
      const raw = localStorage.getItem('ts_dash_spaces');
      if (raw) setDashSelState(JSON.parse(raw));
    } catch { /* ignore */ }
  }, [refresh]);

  const setDashSel = useCallback((v: string[] | null) => {
    setDashSelState(v);
    try { localStorage.setItem('ts_dash_spaces', JSON.stringify(v)); } catch { /* ignore */ }
  }, []);

  const addTask: Ctx['addTask'] = useCallback(async (input) => {
    try {
      const { task } = await api('/api/tasks', 'POST', input);
      setTasks((p) => [...p, task]);
      return task;
    } catch (e: any) { setError(e.message); return null; }
  }, []);

  const patchTask: Ctx['patchTask'] = useCallback(async (id, patch) => {
    const now = new Date().toISOString();
    setTasks((p) => p.map((t) => t.id === id ? { ...t, ...patch, ...(patch.status ? { completed_at: patch.status === 'done' ? (t.completed_at ?? now) : null } : {}) } : t));
    try {
      const { task } = await api(`/api/tasks/${id}`, 'PATCH', patch);
      setTasks((p) => p.map((t) => (t.id === id ? task : t)));
    } catch (e: any) { setError(e.message); refresh(); }
  }, [refresh]);

  const removeTask: Ctx['removeTask'] = useCallback(async (id) => {
    setTasks((p) => p.filter((t) => t.id !== id));
    try { await api(`/api/tasks/${id}`, 'DELETE'); } catch (e: any) { setError(e.message); refresh(); }
  }, [refresh]);

  const addSpace: Ctx['addSpace'] = useCallback(async (input) => {
    try {
      const { space } = await api('/api/spaces', 'POST', input);
      setSpaces((p) => [...p, space]);
      return space;
    } catch (e: any) { setError(e.message); return null; }
  }, []);

  const patchSpace: Ctx['patchSpace'] = useCallback(async (id, patch) => {
    setSpaces((p) => p.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    try {
      const { space } = await api(`/api/spaces/${id}`, 'PATCH', patch);
      setSpaces((p) => p.map((s) => (s.id === id ? space : s)));
    } catch (e: any) { setError(e.message); refresh(); }
  }, [refresh]);

  const removeSpace: Ctx['removeSpace'] = useCallback(async (id) => {
    setSpaces((p) => p.filter((s) => s.id !== id));
    setTasks((p) => p.filter((t) => t.space_id !== id));
    setDashSelState((p) => (p ? p.filter((x) => x !== id) : p));
    try { await api(`/api/spaces/${id}`, 'DELETE'); } catch (e: any) { setError(e.message); refresh(); }
  }, [refresh]);

  const value = useMemo(
    () => ({ spaces, tasks, loaded, error, refresh, addTask, patchTask, removeTask, addSpace, patchSpace, removeSpace, modal, setModal, dashSel, setDashSel }),
    [spaces, tasks, loaded, error, refresh, addTask, patchTask, removeTask, addSpace, patchSpace, removeSpace, modal, dashSel, setDashSel]
  );
  return <C.Provider value={value}>{children}</C.Provider>;
}
