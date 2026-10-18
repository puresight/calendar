import { useState } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import {
  saveCategory,
  setCategoryVisible,
  renameCategory,
  softDeleteCategory,
  softDeleteEventsInCategory,
  type Category,
} from '@/db/calendar';

export const CATEGORY_PALETTE = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#0ea5e9', '#a855f7'];

function CategoryRow({
  cat,
  onEdit,
}: {
  cat: Category;
  onEdit: (c: Category) => void;
}) {
  const visible = cat.isVisible !== 0;
  return (
    <div className="group flex min-h-[44px] items-center gap-2 rounded-xl px-2 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800">
      <button
        type="button"
        onClick={() => setCategoryVisible(cat.id, !visible)}
        role="checkbox"
        aria-checked={visible}
        aria-label={`Show ${cat.name} events`}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors"
        style={{
          backgroundColor: visible ? cat.color : 'transparent',
          borderColor: visible ? cat.color : '#94a3b8',
        }}
      >
        {visible && <Check className="h-4 w-4 text-white" strokeWidth={3} />}
      </button>
      <button
        type="button"
        onClick={() => onEdit(cat)}
        className="flex-1 truncate text-left text-sm font-medium text-slate-700 dark:text-slate-200"
      >
        {cat.name}
      </button>
      <button
        type="button"
        onClick={() => onEdit(cat)}
        className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 opacity-0 transition-opacity hover:bg-slate-200 hover:text-slate-600 group-hover:opacity-100 dark:hover:bg-slate-700"
        aria-label={`Edit ${cat.name}`}
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function CategoryEditorModal({
  editing,
  onClose,
}: {
  editing: Category | 'new' | null;
  onClose: () => void;
}) {
  const isNew = editing === 'new';
  const cat = isNew ? null : editing;
  const [name, setName] = useState(cat?.name ?? '');
  const [color, setColor] = useState(cat?.color ?? CATEGORY_PALETTE[0]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!editing) return null;

  const save = async () => {
    if (!name.trim()) {
      setError('Give the category a name.');
      return;
    }
    setBusy(true);
    try {
      if (isNew) {
        await saveCategory(name.trim(), color);
      } else if (cat) {
        await renameCategory(cat.id, name.trim(), color);
      }
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!cat) return;
    setBusy(true);
    try {
      await softDeleteEventsInCategory(cat.id);
      await softDeleteCategory(cat.id);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-white';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-sm rounded-t-3xl bg-white p-5 shadow-glow-lg sm:rounded-3xl dark:bg-slate-900">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          {isNew ? 'New category' : 'Edit category'}
        </h2>

        <div className="mt-4 space-y-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Category name"
            className={inputCls}
            autoFocus
          />
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Color</p>
            <div className="flex gap-2">
              {CATEGORY_PALETTE.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setColor(p)}
                  aria-label={`Color ${p}`}
                  className={`h-8 w-8 rounded-full transition-transform ${
                    color === p ? 'scale-110 ring-2 ring-offset-2 ring-slate-400 dark:ring-offset-slate-900' : ''
                  }`}
                  style={{ backgroundColor: p }}
                />
              ))}
            </div>
          </div>
          {error && <p className="text-sm font-medium text-attention-700 dark:text-attention-300">{error}</p>}
        </div>

        <div className="mt-5 flex items-center gap-2">
          {!isNew && (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-red-200 text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/40"
              aria-label="Delete category and its events"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="h-11 flex-1 rounded-full border border-slate-200 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="h-11 flex-1 rounded-full bg-indigo-600 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-400"
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function CategoryPanel({
  categories,
  onNewCategory,
  onEditCategory,
  compact = false,
  onDone,
}: {
  categories: Category[];
  onNewCategory: () => void;
  onEditCategory: (c: Category) => void;
  compact?: boolean;
  onDone?: () => void;
}) {
  return (
    <div className="flex flex-col">
      <div className={`mb-2 flex items-center justify-between ${compact ? '' : 'px-0'}`}>
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">Categories</h2>
        {onDone && (
          <button
            type="button"
            onClick={onDone}
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="space-y-0.5">
        {categories.map((c) => (
          <CategoryRow key={c.id} cat={c} onEdit={onEditCategory} />
        ))}
        {categories.length === 0 && (
          <p className="px-2 py-3 text-xs text-slate-400 dark:text-slate-400">
            No categories yet. Add one to start organizing.
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={onNewCategory}
        className="mt-3 flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 text-sm font-semibold text-indigo-600 transition-colors hover:border-indigo-400 hover:bg-indigo-50/50 dark:border-slate-600 dark:text-indigo-400 dark:hover:bg-indigo-950/30"
      >
        <Plus className="h-4 w-4" />
        New category
      </button>
    </div>
  );
}
