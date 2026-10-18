import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronDown, Repeat } from 'lucide-react';
import { db, type CalendarEvent, type Category } from '@/db/calendar';
import {
  toDateKey,
  fromDateInput,
  monthGrid,
  weekDays,
  addDays,
  formatEventTime,
  eventSortKey,
  WEEKDAY_SHORT,
  WEEKDAY_MED,
  isSameDayKey,
  HOUR_HEIGHT,
  formatHourLabel,
  tint,
  layoutTimedEvents,
} from '@/lib/calendarUtils';
import { expandEvents } from '@/lib/recurrence';
import { useBooleanSetting, SHOW_BIRTHDAYS_KEY } from '@/lib/settings';
import { contactMilestoneEvents, useContacts } from '@/lib/contacts';
import { EventChip } from '@/components/shared';

interface ViewProps {
  cursor: Date;
  selectedDate: Date;
  isMobile?: boolean;
  onSelectDate: (d: Date) => void;
  onOpenEvent: (ev: CalendarEvent) => void;
  onCreateAt: (d: Date, hour?: number) => void;
}

/**
 * Expanded (recurrence-resolved) and visibility-filtered events for a window.
 */
function useCalendarData(from: Date, to: Date) {
  const categories = useLiveQuery(() => db.categories.where('isDeleted').equals(0).toArray(), []) ?? [];
  const rawEvents = useLiveQuery(() => db.events.where('isDeleted').equals(0).toArray(), []) ?? [];
  const contacts = useContacts();
  const [showBirthdays] = useBooleanSetting(SHOW_BIRTHDAYS_KEY, true);

  const catById = useMemo(() => {
    const m = new Map<string, Category>();
    categories.forEach((c) => m.set(c.id, c));
    return m;
  }, [categories]);

  const milestonesCategoryId = useMemo(
    () => categories.find((c) => c.name === 'Milestones')?.id ?? '',
    [categories]
  );

  const milestoneEvs = useMemo(() => {
    if (!showBirthdays || !milestonesCategoryId) return [];
    return contactMilestoneEvents(contacts, milestonesCategoryId);
  }, [showBirthdays, milestonesCategoryId, contacts]);

  const allEvents = useMemo(() => {
    const seen = new Set(rawEvents.map((e) => e.id));
    return [...rawEvents, ...milestoneEvs.filter((e) => !seen.has(e.id))];
  }, [rawEvents, milestoneEvs]);

  const expanded = useMemo(() => expandEvents(allEvents, from, to), [allEvents, from, to]);

  const events = useMemo(() => {
    const visible = new Set(categories.filter((c) => c.isVisible !== 0).map((c) => c.id));
    return expanded.filter((e) => visible.has(e.categoryId));
  }, [expanded, categories]);

  return { events, catById };
}

function sortEvents(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((a, b) => eventSortKey(a).localeCompare(eventSortKey(b)));
}

export function MonthView({ cursor, selectedDate, onSelectDate, onOpenEvent, onCreateAt }: ViewProps) {
  const grid = useMemo(() => monthGrid(cursor), [cursor]);
  const from = grid[0];
  const to = grid[grid.length - 1];
  const { events, catById } = useCalendarData(from, to);
  const todayKey = toDateKey(new Date());

  const byDay = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    events.forEach((ev) => {
      const keys: string[] = [];
      if (ev.allDay) {
        const s = fromDateInput(ev.start.slice(0, 10));
        const e = fromDateInput(ev.end.slice(0, 10));
        for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) keys.push(toDateKey(d));
      } else {
        keys.push(toDateKey(new Date(ev.start)));
      }
      keys.forEach((k) => {
        const arr = m.get(k) ?? [];
        arr.push(ev);
        m.set(k, arr);
      });
    });
    m.forEach((arr) => arr.sort((a, b) => eventSortKey(a).localeCompare(eventSortKey(b))));
    return m;
  }, [events]);

  const isCurrentMonth = (d: Date) => d.getMonth() === cursor.getMonth();

  return (
    <div className="flex h-full flex-col">
      <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700">
        {WEEKDAY_SHORT.map((w, i) => (
          <div key={i} className="py-2 text-center text-xs font-semibold text-slate-500 dark:text-slate-400">
            {w}
          </div>
        ))}
      </div>
      <div className="grid flex-1 grid-cols-7 grid-rows-6">
        {grid.map((d) => {
          const key = toDateKey(d);
          const dayEvents = byDay.get(key) ?? [];
          const isSelected = isSameDayKey(selectedDate, key);
          const isToday = key === todayKey;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDate(d)}
              onDoubleClick={() => onCreateAt(d)}
              className={`flex min-h-[44px] flex-col items-stretch gap-0.5 border-b border-r border-slate-100 p-1 text-left transition-colors dark:border-slate-800 ${
                isCurrentMonth(d) ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/70 dark:bg-slate-900/50'
              } ${isSelected ? 'ring-2 ring-inset ring-indigo-500 dark:ring-indigo-400' : ''} hover:bg-indigo-50/60 dark:hover:bg-slate-800/60`}
            >
              <span
                className={`inline-flex h-6 w-6 items-center justify-center self-center rounded-full text-xs font-semibold ${
                  isToday
                    ? 'bg-indigo-600 text-white dark:bg-indigo-500'
                    : isCurrentMonth(d)
                      ? 'text-slate-700 dark:text-slate-200'
                      : 'text-slate-400 dark:text-slate-400'
                }`}
              >
                {d.getDate()}
              </span>
              <span className="flex flex-col gap-0.5 overflow-hidden">
                {dayEvents.slice(0, 2).map((ev) => (
                  <EventChip key={ev.id} ev={ev} category={catById.get(ev.categoryId)} onClick={() => onOpenEvent(ev)} compact />
                ))}
                {dayEvents.length > 2 && (
                  <span className="px-1 text-[10px] font-medium text-slate-400 dark:text-slate-400">
                    +{dayEvents.length - 2} more
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const GUTTER = 'w-14 shrink-0';

function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

function groupTimedEvents(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const m = new Map<string, CalendarEvent[]>();
  events.forEach((ev) => {
    if (ev.allDay) return;
    const k = toDateKey(new Date(ev.start));
    const arr = m.get(k) ?? [];
    arr.push(ev);
    m.set(k, arr);
  });
  return m;
}

function groupAllDayEvents(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const m = new Map<string, CalendarEvent[]>();
  events.forEach((ev) => {
    if (!ev.allDay) return;
    const s = fromDateInput(ev.start.slice(0, 10));
    const e = fromDateInput(ev.end.slice(0, 10));
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      const k = toDateKey(d);
      const arr = m.get(k) ?? [];
      arr.push(ev);
      m.set(k, arr);
    }
  });
  return m;
}

function DayHeaders({ days }: { days: Date[] }) {
  const todayKey = toDateKey(new Date());
  return (
    <div className="flex border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div className={GUTTER} />
      <div
        className="grid flex-1"
        style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
      >
        {days.map((d) => {
          const key = toDateKey(d);
          const isToday = key === todayKey;
          return (
            <div
              key={key}
              className={`border-l border-slate-100 py-1.5 text-center dark:border-slate-800 ${
                days.length === 1 ? '' : 'first:border-l-0'
              }`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-400">
                {WEEKDAY_MED[d.getDay()]}
              </p>
              <span
                className={`mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                  isToday ? 'bg-indigo-600 text-white dark:bg-indigo-500' : 'text-slate-700 dark:text-slate-200'
                }`}
              >
                {d.getDate()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AllDayChip({
  ev,
  category,
  onClick,
}: {
  ev: CalendarEvent;
  category?: Category;
  onClick: () => void;
}) {
  const color = category?.color ?? '#6366f1';
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ backgroundColor: color }}
      className="flex min-h-[24px] w-full items-center truncate rounded-full px-2 py-0.5 text-left text-[11px] font-semibold text-white shadow-sm transition-transform hover:scale-[1.02]"
    >
      <span className="truncate">{ev.title}</span>
    </button>
  );
}

function TimeGrid({
  days,
  events,
  catById,
  onOpenEvent,
  onCreateAt,
}: {
  days: Date[];
  events: CalendarEvent[];
  catById: Map<string, Category>;
  onOpenEvent: (ev: CalendarEvent) => void;
  onCreateAt: (d: Date, hour?: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [allDayOpen, setAllDayOpen] = useState(true);
  const now = useNow();

  const timedByDay = useMemo(() => groupTimedEvents(events), [events]);
  const allDayByDay = useMemo(() => groupAllDayEvents(events), [events]);

  const firstDayKey = toDateKey(days[0]);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = Math.max(7 * HOUR_HEIGHT - 20, 0);
  }, [firstDayKey]);
  const nowKey = toDateKey(now);
  const showsToday = days.some((d) => toDateKey(d) === nowKey);
  const nowTop = ((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR_HEIGHT;

  const gridCols = { gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* All-day drawer */}
      <div
        className={`z-10 border-b border-slate-200 bg-slate-50/90 backdrop-blur dark:border-slate-800 dark:bg-slate-800/40 ${
          allDayOpen ? '' : ''
        }`}
      >
        <div className="flex items-stretch">
          <div className={`${GUTTER} flex items-start justify-center pt-1.5`}>
            <button
              type="button"
              onClick={() => setAllDayOpen((o) => !o)}
              aria-label={allDayOpen ? 'Collapse all-day section' : 'Expand all-day section'}
              aria-expanded={allDayOpen}
              className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-200/70 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-200 ${allDayOpen ? '' : '-rotate-90'}`}
              />
            </button>
          </div>
          <div className="grid flex-1" style={gridCols}>
            {days.map((d) => {
              const key = toDateKey(d);
              const chips = [...(allDayByDay.get(key) ?? [])].sort(
                (a, b) => eventSortKey(a).localeCompare(eventSortKey(b))
              );
              return (
                <div
                  key={key}
                  className={`min-h-[32px] space-y-1 overflow-hidden border-l border-slate-100 px-1 py-1 transition-all duration-200 dark:border-slate-800 ${
                    days.length === 1 ? '' : 'first:border-l-0'
                  } ${allDayOpen ? 'max-h-40' : 'max-h-[32px]'}`}
                >
                  {allDayOpen ? (
                    chips.map((ev) => (
                      <AllDayChip
                        key={ev.id}
                        ev={ev}
                        category={catById.get(ev.categoryId)}
                        onClick={() => onOpenEvent(ev)}
                      />
                    ))
                  ) : (
                    chips.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setAllDayOpen(true)}
                        className="flex w-full items-center gap-1 rounded-full bg-slate-200/80 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-200"
                      >
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: catById.get(chips[0].categoryId)?.color ?? '#6366f1' }}
                        />
                        {chips.length} all-day
                      </button>
                    )
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Scrollable 24h grid */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="flex">
          {/* Hour gutter */}
          <div className={`${GUTTER} relative`}>
            {HOURS.map((h) => (
              <div key={h} style={{ height: HOUR_HEIGHT }} className="relative">
                {h > 0 && (
                  <span className="absolute -top-1.5 right-2 text-[10px] font-medium text-slate-400 dark:text-slate-400">
                    {formatHourLabel(h)}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Day columns */}
          <div className="relative flex-1">
            <div className="grid" style={gridCols}>
              {days.map((d) => {
                const key = toDateKey(d);
                const positioned = layoutTimedEvents(timedByDay.get(key) ?? [], HOUR_HEIGHT);
                return (
                  <div
                    key={key}
                    className={`relative border-l border-slate-100 dark:border-slate-800 ${
                      days.length === 1 ? '' : 'first:border-l-0'
                    }`}
                  >
                    {HOURS.map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => onCreateAt(d, h)}
                        style={{ height: HOUR_HEIGHT }}
                        className="block w-full border-b border-slate-100/80 text-left transition-colors hover:bg-indigo-50/50 dark:border-slate-800/60 dark:hover:bg-slate-800/40"
                        aria-label={`Add event on ${key} at ${formatHourLabel(h)}`}
                      />
                    ))}

                    {positioned.map(({ ev, top, height, left, width }) => {
                      const color = catById.get(ev.categoryId)?.color ?? '#6366f1';
                      const recurring = ev.recurrence !== 'none' && !ev.id.startsWith('bday__');
                      return (
                        <button
                          key={ev.id}
                          type="button"
                          onClick={() => onOpenEvent(ev)}
                          style={{
                            top,
                            height,
                            left: `${left}%`,
                            width: `${width}%`,
                            borderLeftColor: color,
                            backgroundColor: tint(color, 0.15),
                          }}
                          className="absolute z-10 m-[1px] overflow-hidden rounded-md border-l-4 px-1.5 py-0.5 text-left shadow-glow-sm transition-shadow hover:z-20 hover:shadow-glow"
                        >
                          <p className="flex items-center gap-1 truncate text-[11px] font-semibold leading-tight text-slate-800 dark:text-slate-100">
                            <span className="truncate">{ev.title}</span>
                            {recurring && <Repeat className="h-3 w-3 shrink-0 opacity-60" />}
                          </p>
                          {height > 30 && (
                            <p className="truncate text-[10px] leading-tight text-slate-600 dark:text-slate-300">
                              {formatEventTime(ev)}
                            </p>
                          )}
                          {height > 48 && ev.location && (
                            <p className="truncate text-[10px] leading-tight text-slate-500 dark:text-slate-400">
                              {ev.location}
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Current-time indicator */}
            {showsToday && (
              <div
                className="pointer-events-none absolute left-0 right-0 z-30"
                style={{ top: nowTop }}
                aria-hidden
              >
                <div className="relative border-t-2 border-attention-500">
                  <span className="absolute -left-[5px] -top-[6px] h-2.5 w-2.5 rounded-full bg-attention-500 shadow-glow-sm" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function WeekView({ cursor, isMobile = false, onOpenEvent, onCreateAt }: ViewProps) {
  const days = useMemo(
    () => (isMobile ? Array.from({ length: 3 }, (_, i) => addDays(cursor, i)) : weekDays(cursor)),
    [cursor, isMobile]
  );
  const { events, catById } = useCalendarData(days[0], days[days.length - 1]);

  return (
    <div className="flex h-full flex-col">
      <DayHeaders days={days} />
      <TimeGrid days={days} events={events} catById={catById} onOpenEvent={onOpenEvent} onCreateAt={onCreateAt} />
    </div>
  );
}

export function DayView({ selectedDate, onOpenEvent, onCreateAt }: ViewProps) {
  const days = useMemo(() => [selectedDate], [selectedDate]);
  const { events, catById } = useCalendarData(days[0], days[0]);

  return (
    <div className="flex h-full flex-col">
      <DayHeaders days={days} />
      <TimeGrid days={days} events={events} catById={catById} onOpenEvent={onOpenEvent} onCreateAt={onCreateAt} />
    </div>
  );
}

export function AgendaView({ cursor, onOpenEvent }: Pick<ViewProps, 'cursor' | 'onOpenEvent'>) {
  const from = useMemo(() => new Date(cursor.getFullYear(), cursor.getMonth(), 1), [cursor]);
  const to = useMemo(
    () => new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59),
    [cursor]
  );
  const { events, catById } = useCalendarData(from, to);

  const groups = useMemo(() => {
    const m = new Map<string, { date: Date; events: CalendarEvent[] }>();
    [...events]
      .sort((a, b) => eventSortKey(a).localeCompare(eventSortKey(b)))
      .forEach((ev) => {
        const d = ev.allDay ? fromDateInput(ev.start.slice(0, 10)) : new Date(ev.start);
        const k = toDateKey(d);
        const g = m.get(k) ?? { date: d, events: [] };
        g.events.push(ev);
        m.set(k, g);
      });
    return [...m.values()];
  }, [events]);

  const todayKey = toDateKey(new Date());

  if (groups.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center text-center">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No events this month</p>
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-400">Tap + to plan something.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-800">
      {groups.map(({ date, events: dayEvents }) => {
        const key = toDateKey(date);
        const isToday = key === todayKey;
        return (
          <div key={key} className="flex gap-3 px-3 py-3 sm:px-4">
            <div className="w-12 shrink-0 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-400">
                {WEEKDAY_MED[date.getDay()]}
              </p>
              <span
                className={`mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                  isToday ? 'bg-indigo-600 text-white dark:bg-indigo-500' : 'text-slate-700 dark:text-slate-200'
                }`}
              >
                {date.getDate()}
              </span>
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              {sortEvents(dayEvents).map((ev) => {
                const color = catById.get(ev.categoryId)?.color ?? '#6366f1';
                return (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => onOpenEvent(ev)}
                    style={{ borderLeftColor: color }}
                    className="flex w-full min-h-[44px] items-center gap-3 rounded-xl border-l-[3px] bg-slate-50 px-3 py-2 text-left transition-colors hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-slate-900 dark:text-white">
                        <span className="truncate">{ev.title}</span>
                        {ev.recurrence !== 'none' && !ev.id.startsWith('bday__') && (
                          <Repeat className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-400" />
                        )}
                      </p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {formatEventTime(ev)}
                        {ev.location ? ` · ${ev.location}` : ''}
                      </p>
                    </div>
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/20"
                      style={{ backgroundColor: color }}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
