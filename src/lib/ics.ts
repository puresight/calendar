import type { CalendarEvent } from '@/db/calendar';
import { fromDateInput, toDateKey } from './calendarUtils';
import { normalizeRecurrence } from './recurrence';

function esc(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function unesc(s: string): string {
  return s
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

const pad = (n: number) => String(n).padStart(2, '0');

function dtTimed(d: Date): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function dtDate(d: Date): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

/** RFC 5545 VCALENDAR text for the given events. */
export function buildIcs(events: CalendarEvent[]): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//iLife//Calendar//EN',
    'CALSCALE:GREGORIAN',
  ];
  for (const ev of events) {
    const isAllDay = ev.allDay === 1;
    const s = isAllDay ? fromDateInput(ev.start.slice(0, 10)) : new Date(ev.start);
    const e = isAllDay ? fromDateInput(ev.end.slice(0, 10)) : new Date(ev.end);
    if (Number.isNaN(s.getTime())) continue;
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${ev.id}@ilife.calendar`);
    lines.push(`DTSTAMP:${dtTimed(new Date())}`);
    if (isAllDay) {
      lines.push(`DTSTART;VALUE=DATE:${dtDate(s)}`);
      lines.push(`DTEND;VALUE=DATE:${dtDate(e)}`);
    } else {
      lines.push(`DTSTART:${dtTimed(s)}`);
      lines.push(`DTEND:${dtTimed(e)}`);
    }
    lines.push(`SUMMARY:${esc(ev.title)}`);
    if (ev.description) lines.push(`DESCRIPTION:${esc(ev.description)}`);
    if (ev.location) lines.push(`LOCATION:${esc(ev.location)}`);
    const rec = normalizeRecurrence(ev.recurrence);
    if (rec !== 'none') {
      let rrule = `RRULE:FREQ=${rec.toUpperCase()}`;
      if (typeof ev.recurrenceEnd === 'number') {
        const until = new Date(ev.recurrenceEnd);
        rrule += `;UNTIL=${isAllDay ? dtDate(until) : dtTimed(until)}`;
      }
      lines.push(rrule);
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export interface ParsedIcsEvent {
  title: string;
  allDay: boolean;
  start: string;
  end: string;
  location: string;
  description: string;
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  recurrenceEnd?: number;
}

function parseIcsDate(value: string, isDate: boolean): Date {
  const v = value.trim();
  const y = +v.slice(0, 4);
  const mo = +v.slice(4, 6) - 1;
  const da = +v.slice(6, 8);
  if (isDate) return new Date(y, mo, da);
  const h = +v.slice(9, 11);
  const mi = +v.slice(11, 13);
  const se = +v.slice(13, 15) || 0;
  if (v.endsWith('Z')) return new Date(Date.UTC(y, mo, da, h, mi, se));
  return new Date(y, mo, da, h, mi, se);
}

/** Extracts VEVENT blocks from .ics text. */
export function parseIcs(text: string): ParsedIcsEvent[] {
  const unfolded: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    if ((raw.startsWith(' ') || raw.startsWith('\t')) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] += raw.slice(1);
    } else {
      unfolded.push(raw);
    }
  }

  const out: ParsedIcsEvent[] = [];
  let cur: Record<string, string> | null = null;

  const splitProp = (line: string): { name: string; params: string; value: string } | null => {
    const colon = line.indexOf(':');
    if (colon === -1) return null;
    const left = line.slice(0, colon);
    const semi = left.indexOf(';');
    const name = semi === -1 ? left : left.slice(0, semi);
    const params = semi === -1 ? '' : left.slice(semi + 1);
    return { name: name.toUpperCase(), params: params.toUpperCase(), value: line.slice(colon + 1) };
  };

  for (const line of unfolded) {
    if (line === 'BEGIN:VEVENT') {
      cur = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      if (cur && cur.DTSTART) {
        const allDay = (cur.DTSTART_PARAMS ?? '').includes('VALUE=DATE');
        const start = parseIcsDate(cur.DTSTART, allDay);
        const end = cur.DTEND ? parseIcsDate(cur.DTEND, allDay) : start;
        let recurrence: ParsedIcsEvent['recurrence'] = 'none';
        let recurrenceEnd: number | undefined;
        if (cur.RRULE) {
          const freq = /FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)/i.exec(cur.RRULE)?.[1]?.toLowerCase();
          if (freq === 'daily' || freq === 'weekly' || freq === 'monthly' || freq === 'yearly') {
            recurrence = freq;
          }
          const until = /UNTIL=([0-9TZ]+)/i.exec(cur.RRULE)?.[1];
          if (until) {
            recurrenceEnd = parseIcsDate(until, until.length === 8).getTime();
          }
        }
        out.push({
          title: cur.SUMMARY ? unesc(cur.SUMMARY) : 'Imported event',
          allDay,
          start: allDay ? toDateKey(start) : start.toISOString(),
          end: allDay ? toDateKey(end) : end.toISOString(),
          location: cur.LOCATION ? unesc(cur.LOCATION) : '',
          description: cur.DESCRIPTION ? unesc(cur.DESCRIPTION) : '',
          recurrence,
          recurrenceEnd,
        });
      }
      cur = null;
      continue;
    }
    if (!cur) continue;
    const p = splitProp(line);
    if (!p) continue;
    if (p.name === 'DTSTART') {
      cur.DTSTART = p.value;
      cur.DTSTART_PARAMS = p.params;
    } else if (p.name === 'DTEND') {
      cur.DTEND = p.value;
    } else if (p.name === 'SUMMARY' || p.name === 'DESCRIPTION' || p.name === 'LOCATION' || p.name === 'RRULE') {
      cur[p.name] = p.value;
    }
  }
  return out;
}

export function downloadText(filename: string, content: string, mime = 'text/calendar'): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
