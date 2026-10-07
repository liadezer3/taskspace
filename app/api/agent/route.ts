import { NextResponse } from 'next/server';
import { runAgent } from '@/lib/agent-run';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const messages = Array.isArray(body.messages) ? body.messages.filter((m: any) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string') : [];
    if (!messages.length || messages[messages.length - 1].role !== 'user') {
      return NextResponse.json({ error: 'הודעה חסרה' }, { status: 400 });
    }
    const scope = body.scope?.mode === 'space' && typeof body.scope.spaceId === 'string' ? { mode: 'space' as const, spaceId: body.scope.spaceId } : { mode: 'all' as const };
    return NextResponse.json(await runAgent(messages, scope));
  } catch (e: any) {
    console.error('agent error', e);
    const msg = e?.status === 401 ? 'מפתח ה-OpenAI לא תקין' : e?.message || 'שגיאה';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
