import { NextResponse } from 'next/server';
import { deleteSpace, updateSpace } from '@/lib/store';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const space = await updateSpace(id, await req.json());
    if (!space) return NextResponse.json({ error: 'לא נמצא' }, { status: 404 });
    return NextResponse.json({ space });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deleteSpace(id);
  return NextResponse.json({ ok: true });
}
