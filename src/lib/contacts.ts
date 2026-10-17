import Dexie from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import type { CalendarEvent } from '@/db/calendar';

export interface Contact {
  id: string;
  name: string;
  /** MM-DD */
  birthday?: string;
  /** MM-DD */
  anniversary?: string;
}

/** Used when the CRM suite app is not installed alongside this calendar. */
export const MOCK_CONTACTS: Contact[] = [
  { id: 'mock-maya', name: 'Maya Chen', birthday: '03-04' },
  { id: 'mock-jonah', name: 'Jonah Reyes', birthday: '07-19', anniversary: '09-12' },
  { id: 'mock-priya', name: 'Priya Natarajan', birthday: '12-01' },
  { id: 'mock-sam', name: 'Sam Whitfield', birthday: '01-26' },
];

let externalDb: Dexie | null = null;
try {
  externalDb = new Dexie('iLifeCRMDB');
} catch {
  externalDb = null;
}

/**
 * Reads contacts reactively from the iLife CRM database when present;
 * falls back to a built-in mock list when running standalone.
 */
export function useContacts(): Contact[] {
  return (
    useLiveQuery(async () => {
      if (externalDb) {
        try {
          await externalDb.open();
          if (externalDb.tables.some((t) => t.name === 'contacts')) {
            const rows = (await externalDb.table('contacts').toArray()) as Contact[];
            if (rows.length > 0) return rows;
          }
        } catch {
          // CRM suite not installed — standalone mode
        }
      }
      return MOCK_CONTACTS;
    }, []) ?? MOCK_CONTACTS
  );
}

export function contactAvatar(name: string): { initials: string; color: string } {
  const palette = ['#6366f1', '#0ea5e9', '#f59e0b', '#10b981', '#f43f5e', '#a855f7'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const initials =
    name
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?';
  return { initials, color: palette[hash % palette.length] };
}

/** All-day annual milestone events derived from contact dates (id prefix `bday__`). */
export function contactMilestoneEvents(contacts: Contact[], categoryId: string): CalendarEvent[] {
  const mk = (c: Contact, md: string, title: string, kind: string): CalendarEvent => {
    const ts = new Date().toISOString();
    return {
      id: `bday__${kind}__${c.id}`,
      title,
      categoryId,
      allDay: 1,
      start: `2001-${md}`,
      end: `2001-${md}`,
      location: '',
      description: 'Auto-added from your contacts.',
      linkedContactId: c.id,
      linkedTaskId: '',
      recurrence: 'yearly',
      createdAt: ts,
      updatedAt: ts,
      isDeleted: 0,
      synced: 1,
    };
  };
  const out: CalendarEvent[] = [];
  for (const c of contacts) {
    if (c.birthday) out.push(mk(c, c.birthday, `${c.name}'s birthday`, 'bday'));
    if (c.anniversary) out.push(mk(c, c.anniversary, `${c.name}'s anniversary`, 'anniv'));
  }
  return out;
}
