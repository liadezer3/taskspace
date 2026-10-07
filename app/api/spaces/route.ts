import { NextResponse } from 'next/server';
import { createSpace, listSpaces } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ spaces: await listSpaces() });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    return NextResponse.json({ space: await createSpace(body) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
