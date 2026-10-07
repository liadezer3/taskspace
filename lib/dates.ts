export const TZ = 'Asia/Jerusalem';

/** Today's date (YYYY-MM-DD) in Israel time — used on the server. */
export function todayIL(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Today's date (YYYY-MM-DD) in the browser's local time. */
export function todayLocal(): string {
  const d = new Date();
  return ymd(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

export function ymd(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(s: string, n: number): string {
  const d = parseYmd(s);
  d.setUTCDate(d.getUTCDate() + n);
  return ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function weekdayIndex(s: string): number {
  return parseYmd(s).getUTCDay(); // 0 = Sunday
}

export const HE_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
export const HE_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

export function weekdayHe(s: string) {
  return HE_DAYS[weekdayIndex(s)];
}

export function formatHe(s: string | null, today?: string): string {
  if (!s) return 'ללא תאריך';
  const t = today ?? todayLocal();
  if (s === t) return 'היום';
  if (s === addDays(t, 1)) return 'מחר';
  if (s === addDays(t, -1)) return 'אתמול';
  const d = parseYmd(s);
  const sameYear = d.getUTCFullYear() === parseYmd(t).getUTCFullYear();
  return `${d.getUTCDate()} ב${HE_MONTHS[d.getUTCMonth()]}${sameYear ? '' : ' ' + d.getUTCFullYear()}`;
}

/** Start (Sunday) of the week containing `s`. */
export function weekStart(s: string): string {
  return addDays(s, -weekdayIndex(s));
}
