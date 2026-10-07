// Works in both the Edge runtime (middleware) and Node (route handlers) — uses Web Crypto only.
const enc = new TextEncoder();
export const COOKIE = 'ts_auth';
const MAX_AGE = 60 * 60 * 24 * 30;

function secret() {
  const p = process.env.APP_PASSWORD;
  if (!p) throw new Error('APP_PASSWORD is not set');
  return `taskspace::${p}`;
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
  return Array.from(sig).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function checkPassword(input: string) {
  const real = process.env.APP_PASSWORD ?? '';
  if (!real) return false;
  const [a, b] = await Promise.all([hmac('pw:' + input), hmac('pw:' + real)]);
  return safeEqual(a, b);
}

export async function makeToken() {
  const exp = Date.now() + MAX_AGE * 1000;
  return `${exp}.${await hmac(String(exp))}`;
}

export async function verifyToken(token?: string | null) {
  if (!token) return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return safeEqual(sig, await hmac(exp));
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: MAX_AGE,
};
