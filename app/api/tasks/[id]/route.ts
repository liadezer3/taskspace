import { NextResponse } from 'next/server';
import { deleteTask, updateTask } from '@/lib/store';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const task = await updateTask(id, await req.json());
    if (!task) return NextResponse.json({ error: 'לא נמצא' }, { status: 404 });
    return NextResponse.json({ task });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deleteTask(id);
  return NextResponse.json({ ok: true });
}
