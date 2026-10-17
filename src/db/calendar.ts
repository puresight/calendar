import { useEffect, useState } from 'react';
import Dexie, { type Table } from 'dexie';

export interface Category {
  id: string;
  name: string;
  color: string;
  /** Sub-calendar visibility (filtering); ignored for data sync purposes. */
  isVisible: 0 | 1;
  createdAt: string;
  updatedAt: string;
  isDeleted: 0 | 1;
  synced: 0 | 1;
}

export type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface CalendarEvent {
  id: string;
  title: string;
  categoryId: string;
  allDay: 0 | 1;
  /** ISO datetime or date string (YYYY-MM-DD for all-day) */
  start: string;
  /** ISO datetime or date string (YYYY-MM-DD for all-day) */
  end: string;
  location: string;
  description: string;
  linkedContactId: string;
  /** Kanban suite task link (future app) */
  linkedTaskId: string;
  recurrence: Recurrence;
  /** Timestamp (ms) after which the recurrence stops; undefined = forever */
  recurrenceEnd?: number;
  createdAt: string;
  updatedAt: string;
  isDeleted: 0 | 1;
  synced: 0 | 1;
}

class ILifeCalendarDB extends Dexie {
  categories!: Table<Category, string>;
  events!: Table<CalendarEvent, string>;

  constructor() {
    super('iLifeCalendarDB');
    this.version(1).stores({
      categories: 'id, name, isDeleted',
      events: 'id, categoryId, start, end, isDeleted',
    });
    this.version(2).stores({
      categories: 'id, name, isDeleted, isVisible',
      events: 'id, categoryId, start, end, isDeleted, recurrence, linkedContactId, linkedTaskId',
    });
  }
}

export const db = new ILifeCalendarDB();

const nowIso = () => new Date().toISOString();

const makeCategory = (name: string, color: string, isVisible: 0 | 1 = 1): Category => {
  const ts = nowIso();
  return { id: crypto.randomUUID(), name, color, isVisible, createdAt: ts, updatedAt: ts, isDeleted: 0, synced: 0 };
};

const makeEvent = (
  e: Omit<
    CalendarEvent,
    'id' | 'createdAt' | 'updatedAt' | 'isDeleted' | 'synced' | 'linkedTaskId' | 'recurrence'
  > &
    Partial<Pick<CalendarEvent, 'linkedTaskId' | 'recurrence'>>
): CalendarEvent => {
  const ts = nowIso();
  return {
    ...e,
    linkedTaskId: e.linkedTaskId ?? '',
    recurrence: e.recurrence ?? 'none',
    id: crypto.randomUUID(),
    createdAt: ts,
    updatedAt: ts,
    isDeleted: 0,
    synced: 0,
  };
};

export async function ensureSeeded(): Promise<void> {
  await db.transaction('rw', db.categories, db.events, async () => {
    // Upgrade rows created before v2 (missing isVisible / recurrence / linkedTaskId).
    const cats = await db.categories.toArray();
    const catsNeedingUpgrade = cats.filter((c) => c.isVisible === undefined);
    if (catsNeedingUpgrade.length > 0) {
      await db.categories.bulkPut(catsNeedingUpgrade.map((c) => ({ ...c, isVisible: 1 as const })));
    }
    const evs = await db.events.toArray();
    const evsNeedingUpgrade = evs.filter(
      (e) => e.recurrence === undefined || e.linkedTaskId === undefined
    );
    if (evsNeedingUpgrade.length > 0) {
      await db.events.bulkPut(
        evsNeedingUpgrade.map((e) => ({
          ...e,
          recurrence: e.recurrence ?? ('none' as const),
          linkedTaskId: e.linkedTaskId ?? '',
        }))
      );
    }

    const existing = await db.categories.count();
    if (existing > 0) return;

    const personal = makeCategory('Personal', '#6366f1'); // indigo-500
    const work = makeCategory('Work', '#0ea5e9'); // sky-500
    const milestones = makeCategory('Milestones', '#f59e0b'); // amber-500
    await db.categories.bulkAdd([personal, work, milestones]);

    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    const d = today.getDate();
    const at = (day: number, hh: number, mm = 0) =>
      new Date(y, m, day, hh, mm).toISOString();
    const dateStr = (day: number) => {
      const dt = new Date(y, m, day);
      const mo = String(dt.getMonth() + 1).padStart(2, '0');
      const da = String(dt.getDate()).padStart(2, '0');
      return `${dt.getFullYear()}-${mo}-${da}`;
    };

    await db.events.bulkAdd([
      makeEvent({
        title: 'Coffee with Maya',
        categoryId: personal.id,
        allDay: 0,
        start: at(d, 9, 30),
        end: at(d, 10, 30),
        location: 'Corner Brew, 5th Ave',
        description: 'Catch up before her trip.',
        linkedContactId: '',
      }),
      makeEvent({
        title: 'Quarterly Planning',
        categoryId: work.id,
        allDay: 0,
        start: at(d + 1, 14, 0),
        end: at(d + 1, 16, 0),
        location: 'Meeting Room B',
        description: 'Roadmap review and OKR check-in.',
        linkedContactId: '',
      }),
      makeEvent({
        title: 'Team offsite',
        categoryId: work.id,
        allDay: 1,
        start: dateStr(d + 3),
        end: dateStr(d + 4),
        location: 'Lakeside Retreat Center',
        description: 'Two-day offsite, bring laptop.',
        linkedContactId: '',
      }),
      makeEvent({
        title: "Mom's birthday",
        categoryId: milestones.id,
        allDay: 1,
        start: dateStr(d + 9),
        end: dateStr(d + 9),
        location: '',
        description: 'Order cake and call in the morning.',
        linkedContactId: '',
      }),
    ]);
  });
}

export async function softDeleteEvent(id: string): Promise<void> {
  await db.events.update(id, { isDeleted: 1, synced: 0, updatedAt: nowIso() });
}

export async function saveEvent(
  data: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted' | 'synced'> & { id?: string }
): Promise<string> {
  const id = data.id ?? crypto.randomUUID();
  const ts = nowIso();
  if (data.id) {
    const existing = await db.events.get(data.id);
    if (!existing) throw new Error('Event no longer exists');
    await db.events.put({ ...existing, ...data, id, updatedAt: ts, synced: 0 });
    return id;
  }
  await db.events.add({ ...data, id, createdAt: ts, updatedAt: ts, isDeleted: 0, synced: 0 });
  return id;
}

export async function saveCategory(name: string, color: string, isVisible: 0 | 1 = 1): Promise<string> {
  const ts = nowIso();
  const id = crypto.randomUUID();
  await db.categories.add({ id, name, color, isVisible, createdAt: ts, updatedAt: ts, isDeleted: 0, synced: 0 });
  return id;
}

export async function setCategoryVisible(id: string, visible: boolean): Promise<void> {
  await db.categories.update(id, { isVisible: visible ? 1 : 0, synced: 0, updatedAt: nowIso() });
}

export async function renameCategory(id: string, name: string, color?: string): Promise<void> {
  await db.categories.update(id, { name, ...(color ? { color } : {}), synced: 0, updatedAt: nowIso() });
}

export async function softDeleteCategory(id: string): Promise<void> {
  await db.categories.update(id, { isDeleted: 1, synced: 0, updatedAt: nowIso() });
}

export async function softDeleteEventsInCategory(categoryId: string): Promise<void> {
  const ts = nowIso();
  const evs = await db.events.where('categoryId').equals(categoryId).toArray();
  await db.events.bulkPut(evs.map((e) => ({ ...e, isDeleted: 1 as const, synced: 0 as const, updatedAt: ts })));
}

export function useTheme(): { theme: 'light' | 'dark' | 'system'; setTheme: (t: 'light' | 'dark' | 'system') => void } {
  const [theme, setThemeState] = useState<'light' | 'dark' | 'system'>(() => {
    const stored = localStorage.getItem('ilc-theme');
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  });

  useEffect(() => {
    const apply = () => {
      const dark =
        theme === 'dark' ||
        (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.classList.toggle('dark', dark);
    };
    apply();
    localStorage.setItem('ilc-theme', theme);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);

  return { theme, setTheme: setThemeState };
}
