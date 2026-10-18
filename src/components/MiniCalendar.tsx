import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { db, type CalendarEvent } from '@/db/calendar';
import { addMonths, monthGrid, toDateKey, WEEKDAY_SHORT } from '@/lib/calendarUtils';

export function MiniCalendar({
  cursor,
  selectedDate,
  events: eventsProp,
  onSelectDate,
  onNavigate,
}: {
  cursor: Date;
  selectedDate: Date;
  events?: CalendarEvent[];
  onSelectDate: (d: Date) => void;
  onNavigate: (d: Date) => void;
}) {
  const liveEvents = useLiveQuery(() => db.events.where('isDeleted').equals(0).toArray(), []) ?? [];
  const events = eventsProp ?? liveEvents;
  const grid = useMemo(() => monthGrid(cursor), [cursor]);
  const todayKey = toDateKey(new Date());
  const selectedKey = toDateKey(selectedDate);

  const dotKeys = useMemo(() => {
    const s = new Set<string>();
    events.forEach((ev) => {
      if (ev.allDay) {
        const [y, m, d] = ev.start.slice(0, 10).split('-').map(Number);
        const [ey, em, ed] = ev.end.slice(0, 10).split('-').map(Number);
        for (let dt = new Date(y, m - 1, d); dt <= new Date(ey, em - 1, ed); dt.setDate(dt.getDate() + 1)) {
          s.add(toDateKey(dt));
        }
      } else {
        s.add(toDateKey(new Date(ev.start)));
      }
    });
    return s;
  }, [events]);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-bold text-slate-900 dark:text-white">
          {cursor.toLocaleDateString([], { month: 'long', year: 'numeric' })}
        </p>
        <div className="flex">
          <button
            type="button"
            onClick={() => onNavigate(addMonths(cursor, -1))}
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onNavigate(addMonths(cursor, 1))}
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {WEEKDAY_SHORT.map((w, i) => (
          <div key={i} className="py-1 text-center text-[10px] font-semibold text-slate-400 dark:text-slate-400">
            {w}
          </div>
        ))}
        {grid.map((d) => {
          const key = toDateKey(d);
          const inMonth = d.getMonth() === cursor.getMonth();
          const isToday = key === todayKey;
          const isSelected = key === selectedKey;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDate(d)}
              className={`relative mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                isToday
                  ? 'bg-indigo-600 text-white dark:bg-indigo-500'
                  : isSelected
                    ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-400 dark:bg-indigo-950/50 dark:text-indigo-300'
                    : inMonth
                      ? 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                      : 'text-slate-300 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/50'
              }`}
            >
              {d.getDate()}
              {dotKeys.has(key) && !isToday && (
                <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-indigo-400 dark:bg-indigo-500" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
