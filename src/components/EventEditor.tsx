import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link2, Search, X } from 'lucide-react';
import { db, saveEvent, type CalendarEvent } from '@/db/calendar';
import { fromDateInput, fromTimeInput, toTimeInput, toDateKey } from '@/lib/calendarUtils';
import { normalizeRecurrence, RECURRENCE_OPTIONS, type Recurrence } from '@/lib/recurrence';
import { contactAvatar, useContacts } from '@/lib/contacts';

export interface EventDraft {
  id?: string;
  title: string;
  categoryId: string;
  allDay: boolean;
  date: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  location: string;
  description: string;
  linkedContactId: string;
  linkedTaskId: string;
  recurrence: Recurrence;
  recurrenceEnd?: number;
}

export function draftFromEvent(ev: CalendarEvent): EventDraft {
  const startDate = ev.allDay ? fromDateInput(ev.start.slice(0, 10)) : new Date(ev.start);
  const endDate = ev.allDay ? fromDateInput(ev.end.slice(0, 10)) : new Date(ev.end);
  return {
    id: ev.id,
    title: ev.title,
    categoryId: ev.categoryId,
    allDay: ev.allDay === 1,
    date: toDateKey(startDate),
    endDate: toDateKey(endDate),
    startTime: ev.allDay ? '09:00' : toTimeInput(ev.start),
    endTime: ev.allDay ? '10:00' : toTimeInput(ev.end),
    location: ev.location,
    description: ev.description,
    linkedContactId: ev.linkedContactId,
    linkedTaskId: ev.linkedTaskId,
    recurrence: normalizeRecurrence(ev.recurrence),
    recurrenceEnd: ev.recurrenceEnd,
  };
}

export function blankDraft(date: Date, categoryId: string, startHour?: number): EventDraft {
  const startH = startHour ?? 9;
  const endH = Math.min(startH + 1, 23);
  const endDate = startHour !== undefined && startH + 1 > 23
    ? toDateKey(new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1))
    : toDateKey(date);
  return {
    title: '',
    categoryId,
    allDay: false,
    date: toDateKey(date),
    endDate,
    startTime: `${String(startH).padStart(2, '0')}:00`,
    endTime: `${String(endH).padStart(2, '0')}:00`,
    location: '',
    description: '',
    linkedContactId: '',
    linkedTaskId: '',
    recurrence: 'none',
  };
}

function ContactPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const contacts = useContacts();
  const [query, setQuery] = useState('');
  const selected = contacts.find((c) => c.id === value);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? contacts.filter((c) => c.name.toLowerCase().includes(q)) : contacts;
    return list.slice(0, 5);
  }, [contacts, query]);

  return (
    <div>
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Linked Contact
      </span>
      {selected ? (
        <div className="flex min-h-[44px] items-center gap-2.5 rounded-xl bg-indigo-50 px-3 dark:bg-indigo-950/40">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ backgroundColor: contactAvatar(selected.name).color }}
          >
            {contactAvatar(selected.name).initials}
          </span>
          <span className="flex-1 truncate text-sm font-medium text-slate-800 dark:text-slate-100">{selected.name}</span>
          <button
            type="button"
            onClick={() => {
              onChange('');
              setQuery('');
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-white/70 dark:hover:bg-slate-800"
            aria-label="Remove linked contact"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search contacts…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          {matches.length > 0 && query.trim() !== '' && (
            <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-glow dark:border-slate-700 dark:bg-slate-800">
              {matches.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onChange(c.id);
                    setQuery('');
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ backgroundColor: contactAvatar(c.name).color }}
                  >
                    {contactAvatar(c.name).initials}
                  </span>
                  <span className="truncate text-sm text-slate-800 dark:text-slate-100">{c.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {contacts.length === 0 && (
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-400">No contacts available.</p>
      )}
    </div>
  );
}

export function EventEditor({
  draft,
  onClose,
  onSaved,
}: {
  draft: EventDraft;
  onClose: () => void;
  onSaved: () => void;
}) {
  const categories = useLiveQuery(() => db.categories.where('isDeleted').equals(0).toArray(), []) ?? [];
  const [form, setForm] = useState<EventDraft>(draft);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => setForm(draft), [draft]);

  const set = <K extends keyof EventDraft>(key: K, value: EventDraft[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) {
      setError('Give your event a title.');
      return;
    }
    if (!form.categoryId) {
      setError('Pick a category.');
      return;
    }
    if (form.endDate < form.date) {
      setError('End date cannot be before the start date.');
      return;
    }
    if (!form.allDay && form.endDate === form.date && form.endTime <= form.startTime) {
      setError('End time must be after the start time.');
      return;
    }

    setSaving(true);
    try {
      const startIso = form.allDay ? form.date : fromTimeInput(form.startTime, fromDateInput(form.date)).toISOString();
      const endIso = form.allDay ? form.endDate : fromTimeInput(form.endTime, fromDateInput(form.endDate)).toISOString();
      await saveEvent({
        id: form.id ?? undefined,
        title: form.title.trim(),
        categoryId: form.categoryId,
        allDay: form.allDay ? 1 : 0,
        start: startIso,
        end: endIso,
        location: form.location.trim(),
        description: form.description.trim(),
        linkedContactId: form.linkedContactId,
        linkedTaskId: form.linkedTaskId.trim(),
        recurrence: form.recurrence,
        recurrenceEnd: form.recurrenceEnd,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the event.');
      setSaving(false);
    }
  };

  const inputCls =
    'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500';
  const labelCls = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" />
      <form
        onSubmit={handleSubmit}
        className="relative z-10 flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-glow-lg sm:rounded-3xl dark:bg-slate-900"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{form.id ? 'Edit event' : 'New event'}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <label htmlFor="ev-title" className={labelCls}>Title</label>
            <input
              id="ev-title"
              className={inputCls}
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="e.g. Coffee with Maya"
              autoFocus
            />
          </div>

          <div>
            <span className={labelCls}>Category</span>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => set('categoryId', c.id)}
                  className={`flex min-h-[40px] items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    form.categoryId === c.id
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-950/40 dark:text-indigo-300'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          <label className="flex min-h-[44px] cursor-pointer items-center justify-between rounded-xl bg-slate-50 px-3 dark:bg-slate-800/60">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">All-day event</span>
            <input
              type="checkbox"
              checked={form.allDay}
              onChange={(e) => set('allDay', e.target.checked)}
              className="h-5 w-5 accent-indigo-600"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="ev-start" className={labelCls}>Starts</label>
              <input
                id="ev-start"
                type="date"
                className={inputCls}
                value={form.date}
                onChange={(e) => {
                  set('date', e.target.value);
                  if (form.endDate < e.target.value) set('endDate', e.target.value);
                }}
              />
              {!form.allDay && (
                <input
                  type="time"
                  aria-label="Start time"
                  className={`${inputCls} mt-2`}
                  value={form.startTime}
                  onChange={(e) => set('startTime', e.target.value)}
                />
              )}
            </div>
            <div>
              <label htmlFor="ev-end" className={labelCls}>Ends</label>
              <input
                id="ev-end"
                type="date"
                className={inputCls}
                value={form.endDate}
                min={form.date}
                onChange={(e) => set('endDate', e.target.value)}
              />
              {!form.allDay && (
                <input
                  type="time"
                  aria-label="End time"
                  className={`${inputCls} mt-2`}
                  value={form.endTime}
                  onChange={(e) => set('endTime', e.target.value)}
                />
              )}
            </div>
          </div>

          <div>
            <label htmlFor="ev-recurrence" className={labelCls}>Repeat</label>
            <select
              id="ev-recurrence"
              className={inputCls}
              value={form.recurrence}
              onChange={(e) => set('recurrence', e.target.value as Recurrence)}
            >
              {RECURRENCE_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
            {form.recurrence !== 'none' && (
              <div className="mt-2">
                <label htmlFor="ev-recurrence-end" className="mb-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Repeat until (optional)
                </label>
                <input
                  id="ev-recurrence-end"
                  type="date"
                  className={inputCls}
                  value={form.recurrenceEnd ? toDateKey(new Date(form.recurrenceEnd)) : ''}
                  onChange={(e) =>
                    set('recurrenceEnd', e.target.value ? fromDateInput(e.target.value).getTime() : undefined)
                  }
                />
              </div>
            )}
          </div>

          <div>
            <label htmlFor="ev-location" className={labelCls}>Location</label>
            <input
              id="ev-location"
              className={inputCls}
              value={form.location}
              onChange={(e) => set('location', e.target.value)}
              placeholder="Add a place (optional)"
            />
          </div>

          <ContactPicker value={form.linkedContactId} onChange={(id) => set('linkedContactId', id)} />

          <div>
            <label htmlFor="ev-task" className={labelCls}>Linked Task</label>
            <div className="relative">
              <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="ev-task"
                className={`${inputCls} pl-9`}
                value={form.linkedTaskId}
                onChange={(e) => set('linkedTaskId', e.target.value)}
                placeholder="Paste a task ID (Kanban suite)"
              />
            </div>
          </div>

          <div>
            <label htmlFor="ev-desc" className={labelCls}>Notes</label>
            <textarea
              id="ev-desc"
              className={`${inputCls} min-h-[88px] resize-y`}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Any details worth remembering"
            />
          </div>

          {error && (
            <p className="rounded-xl bg-attention-50/60 px-3 py-2 text-sm font-medium text-attention-800 dark:bg-attention-950/50 dark:text-attention-300" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="flex gap-3 border-t border-slate-100 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="h-12 rounded-full border border-slate-200 px-5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="h-12 flex-1 rounded-full bg-indigo-600 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-400"
          >
            {saving ? 'Saving…' : form.id ? 'Save changes' : 'Create event'}
          </button>
        </div>
      </form>
    </div>
  );
}
