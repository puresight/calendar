import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Filter,
  List,
  Menu,
  Plus,
  Settings,
  Sun,
} from 'lucide-react';
import { db, ensureSeeded, softDeleteEvent, useTheme, type CalendarEvent } from '@/db/calendar';
import {
  addDays,
  addMonths,
  formatDayHeading,
  formatMonthYear,
  type ViewMode,
  VIEW_MODES,
} from '@/lib/calendarUtils';
import { ThemeToggle, ViewSwitcher, EventDetailSheet } from '@/components/shared';
import { MonthView, WeekView, DayView, AgendaView } from '@/components/views';
import { EventEditor, blankDraft, draftFromEvent, type EventDraft } from '@/components/EventEditor';
import { MiniCalendar } from '@/components/MiniCalendar';
import { CategoryPanel, CategoryEditorModal } from '@/components/Sidebar';
import { SettingsMenu } from '@/components/SettingsMenu';
import type { Category } from '@/db/calendar';

const NAV_ICONS: Record<ViewMode, typeof Sun> = {
  month: CalendarDays,
  week: Columns3,
  day: Sun,
  agenda: List,
};

export default function App() {
  const [ready, setReady] = useState(false);
  const { theme, setTheme } = useTheme();
  const [view, setView] = useState<ViewMode>('month');
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [detailEvent, setDetailEvent] = useState<CalendarEvent | null>(null);
  const [editorDraft, setEditorDraft] = useState<EventDraft | null>(null);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [categoryModal, setCategoryModal] = useState<Category | 'new' | null>(null);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    ensureSeeded().finally(() => setReady(true));
  }, []);

  const categories = useLiveQuery(() => db.categories.where('isDeleted').equals(0).toArray(), []) ?? [];
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const goPrev = () => {
    if (view === 'month' || view === 'agenda') setCursor((c) => addMonths(c, -1));
    else if (view === 'week') setCursor((c) => addDays(c, isMobile ? -3 : -7));
    else setCursor((c) => addDays(c, -1));
  };
  const goNext = () => {
    if (view === 'week') setCursor((c) => addDays(c, isMobile ? 3 : 7));
    else if (view === 'day') setCursor((c) => addDays(c, 1));
    else setCursor((c) => addMonths(c, 1));
  };
  const goToday = () => {
    const now = new Date();
    setCursor(now);
    setSelectedDate(now);
  };

  const openCreate = (d: Date, startHour?: number) => {
    if (categories.length === 0) return;
    setDetailEvent(null);
    setEditorDraft(blankDraft(d, categories[0].id, startHour));
  };

  const openEdit = (ev: CalendarEvent) => {
    setDetailEvent(null);
    setEditorDraft(draftFromEvent(ev));
  };

  const handleDelete = async (ev: CalendarEvent) => {
    setDetailEvent(null);
    await softDeleteEvent(ev.id);
  };

  const headerDateLabel =
    view === 'day' ? formatDayHeading(selectedDate) : formatMonthYear(cursor);

  const stepLabel = view === 'week' ? 'Week' : view === 'day' ? 'Day' : 'Month';

  const viewProps = {
    cursor,
    selectedDate,
    isMobile,
    onSelectDate: (d: Date) => {
      setSelectedDate(d);
      setCursor(d);
    },
    onOpenEvent: setDetailEvent,
    onCreateAt: openCreate,
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
          <p className="text-sm text-slate-400">Loading your calendar…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Header */}
      <header className="z-20 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div className="flex items-center gap-2 px-3 py-2 sm:px-4">
          <button
            type="button"
            onClick={() => setSidebarOpen((o) => !o)}
            className="hidden h-11 w-11 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 md:flex dark:text-slate-400 dark:hover:bg-slate-800"
            aria-label="Toggle sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex min-w-0 items-center gap-2">
            <CalendarRange className="h-5 w-5 shrink-0 text-indigo-600 dark:text-indigo-400" />
            <h1 className="truncate text-base font-bold sm:text-lg">{headerDateLabel}</h1>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <div className="hidden items-center rounded-full bg-slate-100 dark:bg-slate-800 sm:flex">
              <button
                type="button"
                onClick={goPrev}
                className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                aria-label={`Previous ${stepLabel.toLowerCase()}`}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={goToday}
                className="px-2 text-xs font-bold text-indigo-600 dark:text-indigo-400"
              >
                Today
              </button>
              <button
                type="button"
                onClick={goNext}
                className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                aria-label={`Next ${stepLabel.toLowerCase()}`}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="hidden sm:block">
              <ViewSwitcher view={view} setView={setView} />
            </div>
            <ThemeToggle theme={theme} setTheme={setTheme} />
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="flex h-11 w-11 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              aria-label="Settings"
            >
              <Settings className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => openCreate(selectedDate)}
              className="hidden h-10 items-center gap-1.5 rounded-full bg-indigo-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 md:flex dark:bg-indigo-500 dark:hover:bg-indigo-400"
            >
              <Plus className="h-4 w-4" />
              New event
            </button>
          </div>
        </div>

        {/* Mobile: month nav + view tabs */}
        <div className="flex items-center justify-between px-3 pb-2 pt-0.5 sm:hidden">
          <div className="flex items-center">
            <button
              type="button"
              onClick={goPrev}
              className="flex h-11 w-11 items-center justify-center rounded-full text-slate-500 dark:text-slate-400"
              aria-label="Previous"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={goToday}
              className="min-h-[36px] rounded-full bg-indigo-50 px-3 text-xs font-bold text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400"
            >
              Today
            </button>
            <button
              type="button"
              onClick={goNext}
              className="flex h-11 w-11 items-center justify-center rounded-full text-slate-500 dark:text-slate-400"
              aria-label="Next"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setFilterSheetOpen(true)}
              className="relative ml-1 flex h-11 w-11 items-center justify-center rounded-full text-slate-500 dark:text-slate-400"
              aria-label="Filter categories"
            >
              <Filter className="h-5 w-5" />
              {categories.some((c) => c.isVisible === 0) && (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-indigo-500" />
              )}
            </button>
          </div>
          <ViewSwitcher view={view} setView={setView} />
        </div>
      </header>

      {/* Body */}
      <div className="flex min-h-0 flex-1">
        {/* Desktop sidebar */}
        {sidebarOpen && (
          <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white p-3 md:block dark:border-slate-800 dark:bg-slate-900">
            <MiniCalendar
              cursor={cursor}
              selectedDate={selectedDate}
              onSelectDate={(d) => {
                setSelectedDate(d);
                setCursor(d);
              }}
              onNavigate={setCursor}
            />
            <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
              <CategoryPanel
                categories={categories}
                onNewCategory={() => setCategoryModal('new')}
                onEditCategory={(c) => setCategoryModal(c)}
              />
            </div>
          </aside>
        )}

        {/* Main pane */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-white md:m-3 md:rounded-3xl md:border md:border-slate-200 md:shadow-sm dark:border-slate-800">
          <div className="min-h-0 flex-1 overflow-hidden">
            {view === 'month' && <MonthView {...viewProps} />}
            {view === 'week' && <WeekView {...viewProps} />}
            {view === 'day' && <DayView {...viewProps} />}
            {view === 'agenda' && <AgendaView cursor={cursor} onOpenEvent={setDetailEvent} />}
          </div>
        </main>
      </div>

      {/* Mobile FAB */}
      <button
        type="button"
        onClick={() => openCreate(selectedDate)}
        className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 transition-transform active:scale-95 sm:hidden dark:bg-indigo-500"
        aria-label="New event"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Mobile bottom nav */}
      <nav className="z-30 flex items-center justify-around border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] pt-1 sm:hidden dark:border-slate-800 dark:bg-slate-900">
        {VIEW_MODES.map(({ id, label }) => {
          const Icon = NAV_ICONS[id];
          const active = view === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              className={`flex min-h-[52px] min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors ${
                active ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </button>
          );
        })}
      </nav>

      {/* Sheets */}
      {detailEvent && (
        <EventDetailSheet
          ev={detailEvent}
          category={catById.get(detailEvent.categoryId)}
          onClose={() => setDetailEvent(null)}
          onEdit={() => openEdit(detailEvent)}
          onDelete={() => handleDelete(detailEvent)}
        />
      )}
      {editorDraft && (
        <EventEditor
          draft={editorDraft}
          onClose={() => setEditorDraft(null)}
          onSaved={() => setEditorDraft(null)}
        />
      )}
      {settingsOpen && <SettingsMenu onClose={() => setSettingsOpen(false)} />}
      {filterSheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setFilterSheetOpen(false)}
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
          />
          <div className="relative z-10 w-full max-w-sm rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl dark:bg-slate-900">
            <CategoryPanel
              categories={categories}
              onNewCategory={() => {
                setFilterSheetOpen(false);
                setCategoryModal('new');
              }}
              onEditCategory={(c) => {
                setFilterSheetOpen(false);
                setCategoryModal(c);
              }}
              compact
              onDone={() => setFilterSheetOpen(false)}
            />
          </div>
        </div>
      )}
      <CategoryEditorModal editing={categoryModal} onClose={() => setCategoryModal(null)} />
    </div>
  );
}
