import { NextResponse } from 'next/server';
import { createTask, listTasks } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ tasks: await listTasks() });
}

export async function POST(req: Request) {
  try {
    return NextResponse.json({ task: await createTask(await req.json()) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
