export type ViewMode = 'month' | 'week' | 'day' | 'agenda';

export const VIEW_MODES: { id: ViewMode; label: string }[] = [
  { id: 'month', label: 'Month' },
  { id: 'week', label: 'Week' },
  { id: 'day', label: 'Day' },
  { id: 'agenda', label: 'Agenda' },
];

export const WEEKDAY_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export const WEEKDAY_MED = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function toDateKey(d: Date): string {
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mo}-${da}`;
}

export function fromTimeInput(t: string, base: Date): Date {
  const [h, m] = t.split(':').map(Number);
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m);
}

export function toTimeInput(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function toDateInput(d: Date): string {
  return toDateKey(d);
}

export function fromDateInput(s: string): Date {
  const [y, mo, da] = s.split('-').map(Number);
  return new Date(y, mo - 1, da);
}

export function formatEventTime(ev: { allDay: 0 | 1; start: string; end: string }): string {
  if (ev.allDay) {
    const s = fromDateInput(ev.start.slice(0, 10));
    const e = fromDateInput(ev.end.slice(0, 10));
    if (toDateKey(s) === toDateKey(e)) return 'All day';
    return `All day · ${formatShort(s)} – ${formatShort(e)}`;
  }
  const s = new Date(ev.start);
  const e = new Date(ev.end);
  const day = new Date(s.getFullYear(), s.getMonth(), s.getDate());
  const endDay = new Date(e.getFullYear(), e.getMonth(), e.getDate());
  const t = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (toDateKey(day) === toDateKey(endDay)) {
    return `${t(s)} – ${t(e)}`;
  }
  return `${formatShort(s)} ${t(s)} – ${formatShort(e)} ${t(e)}`;
}

export function formatShort(d: Date): string {
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function formatMonthYear(d: Date): string {
  return d.toLocaleDateString([], { month: 'long', year: 'numeric' });
}

export function formatDayHeading(d: Date): string {
  return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

export function isSameDayKey(a: Date, key: string): boolean {
  return toDateKey(a) === key;
}

export function overlapsRange(ev: { allDay: 0 | 1; start: string; end: string }, from: Date, to: Date): boolean {
  if (ev.allDay) {
    const s = fromDateInput(ev.start.slice(0, 10));
    const e = fromDateInput(ev.end.slice(0, 10));
    return s.getTime() <= to.getTime() && e.getTime() >= from.getTime();
  }
  const s = new Date(ev.start);
  const e = new Date(ev.end);
  return s.getTime() <= to.getTime() && e.getTime() >= from.getTime();
}

export function eventSortKey(ev: { allDay: 0 | 1; start: string }): string {
  // all-day events first, then by start time
  return `${ev.allDay ? '0' : '1'}_${ev.start}`;
}

export const HOUR_HEIGHT = 60;

export function formatHourLabel(h: number): string {
  if (h === 0) return '12 AM';
  if (h === 12) return '12 PM';
  return `${h % 12} ${h < 12 ? 'AM' : 'PM'}`;
}

/** Convert #rrggbb to rgba() with the given alpha. */
export function tint(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export interface PositionedEvent {
  ev: { id: string; title: string; location: string; allDay: 0 | 1; start: string; end: string };
  /** px from top of the grid */
  top: number;
  /** px height of the block */
  height: number;
  /** % offset from left of the day column */
  left: number;
  /** % width of the day column */
  width: number;
}

/**
 * Lay out timed events for one day column: vertical geometry from timestamps,
 * horizontal columns for overlapping events (equal split of the column width).
 */
export function layoutTimedEvents<T extends { id: string; start: string; end: string }>(
  events: T[],
  hourHeight: number
): { ev: T; top: number; height: number; left: number; width: number }[] {
  const items = [...events].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime() || new Date(a.end).getTime() - new Date(b.end).getTime()
  );

  const result: { ev: T; top: number; height: number; left: number; width: number }[] = [];
  let cluster: { ev: T; start: number; end: number }[] = [];
  let clusterEnd = -1;

  const flush = () => {
    if (cluster.length === 0) return;
    const columnEnds: number[] = [];
    const assigned = cluster.map((item) => {
      let col = columnEnds.findIndex((end) => end <= item.start);
      if (col === -1) {
        columnEnds.push(item.end);
        col = columnEnds.length - 1;
      } else {
        columnEnds[col] = item.end;
      }
      return { ...item, col };
    });
    const total = columnEnds.length;
    assigned.forEach(({ ev, start, end, col }) => {
      const top = (start / 60) * hourHeight;
      const height = Math.max(((end - start) / 60) * hourHeight - 2, 18);
      result.push({ ev, top, height, left: (col / total) * 100, width: (1 / total) * 100 });
    });
    cluster = [];
  };

  items.forEach((ev) => {
    const s = new Date(ev.start);
    const e = new Date(ev.end);
    const start = s.getHours() * 60 + s.getMinutes();
    const endRaw = e.getHours() * 60 + e.getMinutes();
    // Clamp to this day; treat zero-length or overnight ends as ending within the day.
    const end = endRaw > start ? Math.min(endRaw, 24 * 60) : Math.min(start + 30, 24 * 60);
    if (cluster.length > 0 && start >= clusterEnd) flush();
    cluster.push({ ev, start, end });
    clusterEnd = Math.max(clusterEnd, end);
  });
  flush();

  return result;
}

/** 6x7 grid of days covering the month of `cursor`, weeks starting Sunday. */
export function monthGrid(cursor: Date): Date[] {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = new Date(first.getFullYear(), first.getMonth(), first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

export function weekDays(cursor: Date): Date[] {
  const start = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - cursor.getDay());
  return Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
