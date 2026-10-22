# Calendar Application Architecture Specification

## 0. Status: Done vs. TODO

### Done (Prompted & Architected)

- **Storage & Schema Foundations:**
- Local-first persistence engine specified using Dexie.js (`iLifeCalendarDB`) storing `categories` and `events`.
- Time-sortable UUID identifiers (`crypto.randomUUID()`) paired with `workspaceId`, `createdAt`, `updatedAt`, `isDeleted` (soft delete), and `synced` flags.
- Default category seeding ("Personal", "Work", "Milestones") with distinct color tokens and sample timed/all-day events.

- **Layout & Multi-View Geometry:**
- Responsive view modes: Month grid, Agenda/Schedule list, Day time-grid, and Week time-grid.
- Desktop split layout (mini-calendar navigator + category panel on the left, full calendar viewport on the right) and mobile-first adaptive view (compact month scrubber / swipeable column window with sticky headers).
- 24-hour vertical scroll container with 60-minute time row increments and labeled hour markers.
- Dedicated collapsible top drawer for `isAllDay: true` multi-day and single-day capsule chips.
- Dynamic vertical positioning (`top`, `height`) and horizontal overlap distribution algorithm for concurrent timed events.
- Real-time current-time red indicator line with auto-updating vertical position.
- Empty slot tap-to-create and event tap-to-inspect flows.

- **Categories & Recurrence Engine:**
- Interactive category visibility toggles that filter rendered events reactively across all views.
- Client-side recurrence expansion engine supporting `daily`, `weekly`, `monthly`, and `yearly` recurrences without database row duplication.
- Recurring event indicator badges.

- **Suite Interoperability & Portability:**
- CRM Contact linking stub (`contactIds`) with avatar display on event detail sheets.
- Automated "Milestones" pipeline design for deriving annual recurring all-day events from CRM contact labeled dates (`birthday`, `anniversary`).
- Kanban task linkage placeholder (`linkedTaskId`).
- RFC 5545 `.ics` export and import parser engine.

- **Design & System Parity:**
- Material 3 surface elevation, Slate/Indigo palette tokens, 48px touch targets, and unified Light/Dark/System theme synchronization.

### TODO (Implementation Remaining)

- **Cloudflare Edge Deployment:**
- Cloudflare Worker API wrapper with Hono route grouping (`/api/events`, `/api/categories`, `/api/sync`).
- D1 SQLite table creation and SQL migration scripts.

- **Sync & Auth Integration:**
- Background bidirectional sync worker reconciling local Dexie mutations (`synced === 0`) with Cloudflare D1 via timestamps.
- Consumption of the central SSO dual-cookie session token (`.domain.cc`) to enforce workspace multi-tenancy.

- **Live Cross-Database Handshakes:**
- Direct reactive queries across Dexie databases (`iLifeCalendarDB` $\leftrightarrow$ `iLifeCRMDB` and `iLifeKanbanDB`) to resolve actual contact names, photos, and task statuses live.

- **Complex Recurrence Exceptions:**
- Handling "Edit this event only" vs. "Edit all recurring events" (recurrence exception rules / `EXDATE` handling).

---

## 1. System Overview

The Calendar application is an edge-native, local-first scheduling and time-management tool designed for personal planning, startup operational cadences, and automated milestone tracking.

Like other apps in the suite, it follows an offline-first architecture where the client browser functions as an autonomous system reading from and writing to IndexedDB via Dexie.js, with asynchronous delta-synchronization targeting Cloudflare Workers and Cloudflare D1.

---

## 2. Data Models & Schemas

### Client-Side IndexedDB Schema (TypeScript / Dexie.js)

```typescript
import Dexie, { type Table } from "dexie";

export type RecurrenceFrequency =
  | "none"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly";

export interface CalendarCategory {
  id: string; // UUID
  workspaceId: string;
  name: string; // e.g., "Work", "Personal", "Milestones"
  color: string; // Hex or HSL token
  isVisible: boolean; // Client-side visibility toggle
  createdAt: number;
  updatedAt: number;
}

export interface CalendarEvent {
  id: string; // UUID
  workspaceId: string;
  categoryId: string; // Foreign key -> CalendarCategory.id
  title: string;
  description?: string;
  location?: string;
  start: number; // Unix timestamp ms
  end: number; // Unix timestamp ms
  isAllDay: boolean;
  recurrence: RecurrenceFrequency;
  recurrenceEnd?: number; // Optional Unix timestamp ms

  // Cross-App Suite Linkage Stubs
  contactIds?: string[]; // Linked CRM Contact UUIDs
  linkedTaskId?: string; // Linked Kanban Card ULID (e.g. exo-01jk...)

  createdAt: number;
  updatedAt: number;
  isDeleted: boolean; // Soft delete tombstone for sync
  synced: number; // 0 = pending sync, 1 = synced
}

export class CalendarDatabase extends Dexie {
  categories!: Table<CalendarCategory, string>;
  events!: Table<CalendarEvent, string>;

  constructor() {
    super("iLifeCalendarDB");
    this.version(1).stores({
      categories: "id, workspaceId, name",
      events:
        "id, workspaceId, categoryId, start, end, isAllDay, isDeleted, synced, [workspaceId+start]",
    });
  }
}

export const calendarDb = new CalendarDatabase();
```

### Relational D1 Schema (Cloudflare SQLite)

```sql
CREATE TABLE calendar_categories (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    is_visible INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE calendar_events (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    category_id TEXT NOT NULL REFERENCES calendar_categories(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    location TEXT,
    start_time INTEGER NOT NULL,
    end_time INTEGER NOT NULL,
    is_all_day INTEGER NOT NULL DEFAULT 0,
    recurrence TEXT NOT NULL DEFAULT 'none' CHECK (recurrence IN ('none', 'daily', 'weekly', 'monthly', 'yearly')),
    recurrence_end INTEGER,
    contact_ids JSON DEFAULT '[]',
    linked_task_id TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    is_deleted INTEGER NOT NULL DEFAULT 0,
    synced INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_calendar_events_range ON calendar_events(workspace_id, start_time, end_time, is_deleted);
CREATE INDEX idx_calendar_events_category ON calendar_events(workspace_id, category_id);

```

---

## 3. View Architecture & Time-Grid Geometry

### View Routing & Adaptation

1. **Month Grid:**

- Standard 7x5 or 7x6 day grid calculating dates via `date-fns`.
- Collapses on narrow viewports (`< 768px`) into an Apple-style compact month strip/mini-scrubber paired with an interactive Agenda list underneath.

2. **Agenda View:**

- Chronological card feed grouped by date headers ("Today", "Tomorrow", absolute dates).
- High-contrast category chips, time range badges, and location snippets.

3. **Week & Day Time-Grid Views:**

- **Vertical Grid Scale:** 24 continuous 60-minute rows (default 60px–64px height per hour).
- **All-Day Drawer:** Sticky top section isolating `isAllDay: true` events into solid horizontal capsule chips to prevent vertical grid clutter.
- **Real-Time Indicator:** Horizontal red line positioned at `(currentMinute / 60) * rowHeight` with a red lead circle, refreshing once per minute.
- **Mobile Week View:** Implements a 3-day sliding window or single-day swipe column to preserve readable column widths and 48px touch targets.

### Event Overlap Resolution Algorithm

For overlapping timed events in Day and Week views:

1. Sort active events for the target day by `start` ascending, then by duration descending.
2. Group intersecting events into cluster sets where `eventA.start < eventB.end && eventB.start < eventA.end`.
3. Divide column width evenly among concurrent events ($Width = \frac{100\%}{N}$), calculating horizontal offset ($Left = Index \times Width$) to eliminate visual occlusion.

---

## 4. Recurrence Engine & Portability

### Client-Side Expansion

To preserve minimal database size and avoid unbounded record growth:

- Recurring events store only the parent definition with its `recurrence` cadence and optional `recurrenceEnd`.
- When querying any active date window $[Window_{Start}, Window_{End}]$, an in-memory virtual expansion step iterates occurrences matching the cadence and injects synthetic instance objects into the render pipeline.
- Modifying a parent event updates the rule; deletion flags the root definition.

### RFC 5545 (`.ics`) Interoperability

- **Export:** Serializes non-deleted events into standard VCALENDAR / VEVENT blocks with `UID`, `SUMMARY`, `DESCRIPTION`, `LOCATION`, `DTSTART`, `DTEND`, and `RRULE`.
- **Import:** File reader parses uploaded `.ics` payloads, converting standard iCalendar properties into local Dexie entity records assigned to a designated category.

---

## 5. Cross-Suite Integration Contracts

The Calendar application integrates cleanly across the suite:

- **CRM Integration:**
- Events support an array of `contactIds`. Detail views resolve these IDs to display initials and contact cards.
- Automatically imports labeled dates (`birthday`, `anniversary`) from the CRM's database into the "Milestones" sub-calendar as annual all-day events.

- **Kanban Integration:**
- Supports `linkedTaskId` pointing to a Kanban card ULID (`exo-...`).
- Clicking a linked task trigger navigates or cross-references the relevant card in the workflow tracker.
