import { NextResponse } from 'next/server';
import { runConfirmed } from '@/lib/agent-run';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const calls = Array.isArray(body.calls) ? body.calls.filter((c: any) => ['add_tasks', 'update_tasks', 'delete_tasks'].includes(c?.name)) : [];
    const scope = body.scope?.mode === 'space' && typeof body.scope.spaceId === 'string' ? { mode: 'space' as const, spaceId: body.scope.spaceId } : { mode: 'all' as const };
    return NextResponse.json(await runConfirmed(calls, scope));
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'שגיאה' }, { status: 500 });
  }
}
