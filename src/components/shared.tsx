import { Monitor, Moon, Sun, Repeat, Link2, ExternalLink } from 'lucide-react';
import type { CalendarEvent, Category } from '@/db/calendar';
import {
  fromDateInput,
  formatEventTime,
  type ViewMode,
} from '@/lib/calendarUtils';
import { normalizeRecurrence, RECURRENCE_LABELS } from '@/lib/recurrence';
import { contactAvatar, useContacts, type Contact } from '@/lib/contacts';

export function EventChip({
  ev,
  category,
  onClick,
  compact = false,
}: {
  ev: CalendarEvent;
  category?: Category;
  onClick: () => void;
  compact?: boolean;
}) {
  const color = category?.color ?? '#6366f1';
  const recurring = normalizeRecurrence(ev.recurrence) !== 'none';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 ${
        compact ? 'min-h-[24px]' : 'min-h-[36px]'
      }`}
    >
      <span
        aria-hidden
        className="h-2 w-2 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/20"
        style={{ backgroundColor: color }}
      />
      <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-slate-700 dark:text-slate-200">
        {ev.allDay ? '' : `${new Date(ev.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} `}
        {ev.title}
      </span>
      {recurring && <RecurrenceBadge />}
    </button>
  );
}

export function ThemeToggle({
  theme,
  setTheme,
}: {
  theme: 'light' | 'dark' | 'system';
  setTheme: (t: 'light' | 'dark' | 'system') => void;
}) {
  const options: { id: 'light' | 'dark' | 'system'; icon: typeof Sun; label: string }[] = [
    { id: 'light', icon: Sun, label: 'Light' },
    { id: 'dark', icon: Moon, label: 'Dark' },
    { id: 'system', icon: Monitor, label: 'System' },
  ];
  return (
    <div
      className="flex items-center rounded-full bg-slate-100 p-0.5 dark:bg-slate-800"
      role="group"
      aria-label="Theme"
    >
      {options.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={theme === id}
          onClick={() => setTheme(id)}
          className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
            theme === id
              ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-indigo-400'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}

export function ViewSwitcher({
  view,
  setView,
}: {
  view: ViewMode;
  setView: (v: ViewMode) => void;
}) {
  return (
    <div className="flex items-center rounded-full bg-slate-100 p-0.5 dark:bg-slate-800" role="tablist">
      {(['month', 'week', 'day', 'agenda'] as ViewMode[]).map((v) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={view === v}
          onClick={() => setView(v)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
            view === v
              ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-indigo-400'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

export function RecurrenceBadge({ className = '' }: { className?: string }) {
  return (
    <Repeat
      className={`h-3 w-3 shrink-0 text-slate-400 dark:text-slate-500 ${className}`}
      aria-label="Repeating event"
    />
  );
}

export function LinkedTaskChip({ taskId }: { taskId: string }) {
  if (!taskId) return null;
  return (
    <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Linked Task</p>
        <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
          <Link2 className="h-3 w-3" />
          Task · {taskId.slice(0, 12)}
        </span>
      </div>
    </div>
  );
}

export function EventDetailSheet({
  ev,
  category,
  onClose,
  onEdit,
  onDelete,
}: {
  ev: CalendarEvent;
  category?: Category;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const startDate = ev.allDay ? fromDateInput(ev.start.slice(0, 10)) : new Date(ev.start);
  const contacts = useContacts();
  const contact: Contact | undefined = contacts.find((c) => c.id === ev.linkedContactId);
  const recurring = normalizeRecurrence(ev.recurrence) !== 'none';
  const recLabel = RECURRENCE_LABELS[normalizeRecurrence(ev.recurrence)];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
      />
      <div className="relative z-10 w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl dark:bg-slate-900">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-full ring-1 ring-black/10 dark:ring-white/20"
                style={{ backgroundColor: category?.color ?? '#6366f1' }}
              />
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {category?.name ?? 'Event'}
              </span>
            </div>
            <h2 className="mt-1 truncate text-xl font-bold text-slate-900 dark:text-white">{ev.title}</h2>
            {recurring && (
              <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400">
                <Repeat className="h-3.5 w-3.5" />
                {recLabel}
                {typeof ev.recurrenceEnd === 'number' &&
                  ` · until ${new Date(ev.recurrenceEnd).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-slate-900 dark:text-white">
                {startDate.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
              <p className="text-slate-500 dark:text-slate-400">{formatEventTime(ev)}</p>
            </div>
          </div>
          {ev.location && (
            <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Location</p>
                <p className="mt-0.5 text-slate-900 dark:text-white">{ev.location}</p>
              </div>
            </div>
          )}
          {ev.description && (
            <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Notes</p>
                <p className="mt-0.5 whitespace-pre-wrap text-slate-900 dark:text-white">{ev.description}</p>
              </div>
            </div>
          )}
          {contact && (
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: contactAvatar(contact.name).color }}
              >
                {contactAvatar(contact.name).initials}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Linked Contact</p>
                <p className="truncate font-medium text-slate-900 dark:text-white">{contact.name}</p>
              </div>
              <button
                type="button"
                className="flex min-h-[36px] items-center gap-1 rounded-full border border-slate-200 px-3 text-xs font-semibold text-indigo-600 transition-colors hover:bg-white dark:border-slate-700 dark:text-indigo-400 dark:hover:bg-slate-800"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View in Contacts
              </button>
            </div>
          )}
          {ev.linkedTaskId && <LinkedTaskChip taskId={ev.linkedTaskId} />}
        </div>

        <div className="mt-6 flex gap-3 pb-[env(safe-area-inset-bottom)]">
          <button
            type="button"
            onClick={onDelete}
            className="flex h-12 min-w-[80px] items-center justify-center gap-2 rounded-full border border-red-200 px-4 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="flex h-12 flex-1 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400"
          >
            Edit
          </button>
        </div>
      </div>
    </div>
  );
}
