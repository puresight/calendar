import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Download, Upload, Cake } from 'lucide-react';
import { db, type CalendarEvent } from '@/db/calendar';
import { buildIcs, downloadText, parseIcs } from '@/lib/ics';
import { useBooleanSetting, SHOW_BIRTHDAYS_KEY } from '@/lib/settings';
import { useContacts } from '@/lib/contacts';

function Toggle({
  checked,
  onChange,
  label,
  hint,
  icon: Icon,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint: string;
  icon: typeof Cake;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full min-h-[56px] items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-left transition-colors hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800"
    >
      <Icon className="h-5 w-5 shrink-0 text-indigo-500 dark:text-indigo-400" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</span>
        <span className="block text-xs text-slate-500 dark:text-slate-400">{hint}</span>
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-indigo-600 dark:bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-[22px]' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  );
}

export function SettingsMenu({ onClose }: { onClose: () => void }) {
  const [message, setMessage] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [showBirthdays, setShowBirthdays] = useBooleanSetting(SHOW_BIRTHDAYS_KEY, true);
  const contacts = useContacts();
  const categories = useLiveQuery(() => db.categories.where('isDeleted').equals(0).toArray(), []) ?? [];

  const exportIcs = async () => {
    const events = await db.events.where('isDeleted').equals(0).toArray();
    downloadText('ilife-calendar.ics', buildIcs(events));
    setMessage(`Exported ${events.length} event${events.length === 1 ? '' : 's'}.`);
  };

  const importIcs = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = parseIcs(text);
      if (parsed.length === 0) {
        setMessage('No events found in that file.');
        return;
      }
      const fallbackCategory = categories[0];
      if (!fallbackCategory) {
        setMessage('Create a category first, then import.');
        return;
      }
      const ts = new Date().toISOString();
      const rows: CalendarEvent[] = parsed.map((p) => ({
        id: crypto.randomUUID(),
        title: p.title,
        categoryId: fallbackCategory.id,
        allDay: p.allDay ? 1 : 0,
        start: p.start,
        end: p.end,
        location: p.location,
        description: p.description,
        linkedContactId: '',
        linkedTaskId: '',
        recurrence: p.recurrence,
        recurrenceEnd: p.recurrenceEnd,
        createdAt: ts,
        updatedAt: ts,
        isDeleted: 0,
        synced: 0,
      }));
      await db.events.bulkAdd(rows);
      setMessage(`Imported ${rows.length} event${rows.length === 1 ? '' : 's'} into “${fallbackCategory.name}”.`);
    } catch {
      setMessage('That file could not be read as a calendar file.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-sm rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="space-y-2">
          <Toggle
            checked={showBirthdays}
            onChange={setShowBirthdays}
            label="Contact birthdays & anniversaries"
            hint={`Shows ${contacts.length > 0 ? 'dates from your contacts' : 'dates from your contacts'} as all-day milestones`}
            icon={Cake}
          />

          <button
            type="button"
            onClick={exportIcs}
            className="flex w-full min-h-[52px] items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-left transition-colors hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800"
          >
            <Download className="h-5 w-5 shrink-0 text-indigo-500 dark:text-indigo-400" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">Export .ics</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">Download all events as a calendar file</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full min-h-[52px] items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-left transition-colors hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800"
          >
            <Upload className="h-5 w-5 shrink-0 text-indigo-500 dark:text-indigo-400" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">Import .ics</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">Add events from a calendar file</span>
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".ics,text/calendar"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importIcs(f);
              e.target.value = '';
            }}
          />
        </div>

        {message && (
          <p className="mt-3 rounded-xl bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
