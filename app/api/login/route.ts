import { NextResponse } from 'next/server';
import { COOKIE, checkPassword, cookieOptions, makeToken } from '@/lib/auth';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const ok = await checkPassword(String(body.password ?? ''));
  if (!ok) {
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: 'סיסמה שגויה' }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, await makeToken(), cookieOptions);
  return res;
}
