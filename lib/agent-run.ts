import OpenAI from 'openai';
import { CONFIRM_THRESHOLD, MUTATING, Scope, TOOLS, ToolCall, buildCtx, dryRun, executeTool, systemPrompt } from './agent-tools';

export type ChatMsg = { role: 'user' | 'assistant'; content: string };
export type Pending = { calls: ToolCall[]; count: number; lines: string[] };
export type AgentResponse = { reply: string; mutated: boolean; pending?: Pending };

const MODEL_CANDIDATES = () => {
  const m = process.env.OPENAI_MODEL?.trim();
  return m ? [m] : ['gpt-6-luna', 'openai/gpt-6-luna'];
};

function client() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set');
  return new OpenAI({ apiKey, baseURL: process.env.OPENAI_BASE_URL || undefined });
}

async function complete(messages: any[]) {
  const ai = client();
  let lastErr: any;
  for (const model of MODEL_CANDIDATES()) {
    try {
      return await ai.chat.completions.create({ model, messages, tools: TOOLS as any, tool_choice: 'auto' });
    } catch (e: any) {
      lastErr = e;
      const notFound = e?.status === 404 || e?.code === 'model_not_found';
      if (!notFound) throw e;
    }
  }
  throw lastErr;
}

export async function runAgent(history: ChatMsg[], scope: Scope): Promise<AgentResponse> {
  const ctx = await buildCtx(scope);
  const messages: any[] = [
    { role: 'system', content: systemPrompt(ctx) },
    ...history.slice(-16).map((m) => ({ role: m.role, content: String(m.content).slice(0, 4000) })),
  ];
  let mutated = false;

  for (let step = 0; step < 6; step++) {
    const res = await complete(messages);
    const msg = res.choices[0].message;
    const calls = msg.tool_calls ?? [];
    if (!calls.length) return { reply: (msg.content ?? '').trim() || 'בוצע.', mutated };

    messages.push({ role: 'assistant', content: msg.content ?? null, tool_calls: calls });
    const parsed = calls.map((c: any) => {
      let args: any = {};
      try { args = JSON.parse(c.function.arguments || '{}'); } catch { /* ignore */ }
      return { id: c.id, call: { name: c.function.name, args } as ToolCall };
    });

    // Dry-run mutating calls first: confirm if deleting or touching > 3 tasks in total
    const mut = parsed.filter((p) => MUTATING.has(p.call.name));
    if (mut.length) {
      const dr = await Promise.all(mut.map((p) => dryRun(p.call, ctx)));
      const total = dr.reduce((s, d) => s + d.count, 0);
      const hasDelete = mut.some((p, i) => p.call.name === 'delete_tasks' && dr[i].count > 0);
      if (total > 0 && (hasDelete || total > CONFIRM_THRESHOLD)) {
        const lines = dr.filter((d) => d.count > 0).map((d) => d.label);
        const reply = `הפעולה תשפיע על ${total} משימות:\n${lines.map((l) => `• ${l}`).join('\n')}\nלאשר?`;
        return { reply, mutated, pending: { calls: mut.map((p) => p.call), count: total, lines } };
      }
    }

    for (const p of parsed) {
      const r = await executeTool(p.call, ctx);
      if (MUTATING.has(p.call.name) && r.ok && r.affected > 0) mutated = true;
      messages.push({ role: 'tool', tool_call_id: p.id, content: JSON.stringify({ ok: r.ok, message: r.message, ...(r.data !== undefined ? { data: r.data } : {}) }) });
    }
  }
  return { reply: 'לא הצלחתי להשלים את הבקשה. נסה לנסח אותה אחרת.', mutated };
}

/** Executes calls the user already approved (no threshold check). */
export async function runConfirmed(calls: ToolCall[], scope: Scope): Promise<AgentResponse> {
  const ctx = await buildCtx(scope);
  const out: string[] = [];
  let mutated = false;
  for (const c of calls) {
    if (!MUTATING.has(c.name)) continue;
    const r = await executeTool(c, ctx);
    if (r.ok && r.affected > 0) mutated = true;
    out.push(r.message);
  }
  return { reply: out.length ? `בוצע: ${out.map((x) => x.replace(/\.+$/, '')).join('; ')}.` : 'אין מה לבצע.', mutated };
}
