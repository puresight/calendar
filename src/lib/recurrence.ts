import type { CalendarEvent } from '@/db/calendar';
import { addDays, fromDateInput, toDateKey } from './calendarUtils';

export type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export const RECURRENCE_OPTIONS: { id: Recurrence; label: string }[] = [
  { id: 'none', label: 'Does not repeat' },
  { id: 'daily', label: 'Every day' },
  { id: 'weekly', label: 'Every week' },
  { id: 'monthly', label: 'Every month' },
  { id: 'yearly', label: 'Every year' },
];

export const RECURRENCE_LABELS: Record<Recurrence, string> = {
  none: 'Does not repeat',
  daily: 'Repeats every day',
  weekly: 'Repeats every week',
  monthly: 'Repeats every month',
  yearly: 'Repeats every year',
};

export function normalizeRecurrence(r: string | undefined): Recurrence {
  return r === 'daily' || r === 'weekly' || r === 'monthly' || r === 'yearly' ? r : 'none';
}

function daysInMonth(y: number, m: number): number {
  return new Date(y, m + 1, 0).getDate();
}

function advance(d: Date, rec: Recurrence): Date {
  switch (rec) {
    case 'daily':
      return addDays(d, 1);
    case 'weekly':
      return addDays(d, 7);
    case 'monthly':
      return new Date(
        d.getFullYear(),
        d.getMonth() + 1,
        Math.min(d.getDate(), daysInMonth(d.getFullYear(), d.getMonth() + 1))
      );
    case 'yearly':
      return new Date(d.getFullYear() + 1, d.getMonth(), Math.min(d.getDate(), daysInMonth(d.getFullYear() + 1, d.getMonth())));
    default:
      return d;
  }
}

const MAX_OCCURRENCES = 400;

/**
 * Expand recurring events into concrete occurrences within [from, to].
 * Occurrences share the source row (no DB duplication) and carry a
 * `__<dateKey>` id suffix so edit/delete can resolve back to the series.
 */
export function expandEvents(events: CalendarEvent[], from: Date, to: Date): CalendarEvent[] {
  const out: CalendarEvent[] = [];

  for (const ev of events) {
    const rec = normalizeRecurrence(ev.recurrence);
    const isAllDay = ev.allDay === 1;
    const baseStart = isAllDay ? fromDateInput(ev.start.slice(0, 10)) : new Date(ev.start);
    const baseEnd = isAllDay ? fromDateInput(ev.end.slice(0, 10)) : new Date(ev.end);
    if (Number.isNaN(baseStart.getTime())) continue;

    if (rec === 'none') {
      if (baseEnd >= from && baseStart <= to) out.push(ev);
      continue;
    }

    const until = typeof ev.recurrenceEnd === 'number' ? new Date(ev.recurrenceEnd) : null;
    const spanDays = isAllDay
      ? Math.max(1, Math.round((baseEnd.getTime() - baseStart.getTime()) / 86_400_000) + 1)
      : 1;
    const durationMs = isAllDay ? 0 : Math.max(baseEnd.getTime() - baseStart.getTime(), 15 * 60_000);

    let cursor = new Date(baseStart);
    for (let i = 0; i < MAX_OCCURRENCES; i++) {
      if (until && cursor.getTime() > until.getTime()) break;
      const occEnd = isAllDay ? addDays(cursor, spanDays - 1) : new Date(cursor.getTime() + durationMs);
      if (occEnd >= from && cursor <= to) {
        out.push({
          ...ev,
          id: `${ev.id}__${toDateKey(cursor)}`,
          start: isAllDay ? toDateKey(cursor) : cursor.toISOString(),
          end: isAllDay ? toDateKey(occEnd) : occEnd.toISOString(),
        });
      }
      if (cursor > to) break;
      cursor = advance(cursor, rec);
    }
  }

  return out;
}
