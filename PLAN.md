# TaskTracker - Home Maintenance Mobile Web App

## Context

You have a well-structured Notion database ("Braim Rd Maintenance") with 14 properties and 6 views for tracking home maintenance. But Notion on mobile is clunky for quick task management. You want a fast, phone-friendly PWA to view/add/update tasks with AI-powered prioritization that understands seasonal needs (like pool opening in Saratoga Springs).

**Existing apps researched:** HomeZada (comprehensive but complex), Evergreen Home (simple + DIY guides), Centriq (appliance-focused), BrightNest (educational). Our app takes the best of Evergreen Home's simplicity + AI prioritization that none of them do well.

## Architecture

**Notion as the backend.** No separate database. Your existing data stays in Notion, the app is a mobile-optimized frontend that reads/writes via Notion API through Next.js API routes (keeps API keys server-side).

```
Phone (PWA)       → Next.js on Vercel → Notion API + Claude API   (view/edit/dashboard)
Phone (Telegram)  → OpenClaw           → Notion API               (quick add/update via chat)
                    OpenClaw Cron      → Notion API → Telegram    (daily digest + seasonal suggestions)
```

**OpenClaw** (self-hosted) handles notifications, quick chat-based task creation, and proactive seasonal suggestions — complementing the web app via Telegram.

## Tech Stack

- **Next.js 16** (App Router, React Server Components, Server Actions) + **React 19** + **Tailwind 4**
- **@notionhq/client** for Notion API
- **@anthropic-ai/sdk** for Claude AI (Sonnet for prioritization/classification)
- **Radix UI** for accessible components
- **Lucide React** for icons
- **date-fns** for date handling
- **Vercel Blob** for photo storage (camera → AI classification flow)
- **PWA** manifest + service worker for phone installability
- **Vercel** for deployment

## Notion Database Schema (verified)

The "Braim Rd Maintenance" database has **14 properties**:

| Property | Type | Values / Notes |
|---|---|---|
| **Task** | title | Task name (required) |
| **Status** | status | Not Started, In Progress, On Hold, Completed |
| **Priority** | select | High (red), Medium (yellow), Low (green) |
| **Area** | select | Kitchen, Bathroom, Bedroom, Living Room, Garage, Exterior, Garden, Roof, Laundry, Basement/Attic, Driveway/Walkway, Fence |
| **Sub-location** | text | Free text for specifics (e.g., "master bath", "south fence") |
| **Type** | **multi_select** | Plumbing, Electrical, Painting, Carpentry, Cleaning, Landscaping, HVAC, General Repair |
| **Frequency** | select | One-time, Monthly, Quarterly, Semi-annually, Annually |
| **Due Date** | date | Supports date ranges (start + end) |
| **Date Completed** | date | When task was finished |
| **Assigned To** | person | Notion user(s) |
| **Contractor/Vendor** | text | Name/contact info |
| **Cost Estimate** | number ($) | Estimated cost |
| **Actual Cost** | number ($) | Final cost after completion |
| **Created Time** | auto | System-managed, read-only |

**6 Existing Views:** By Area (board), Current Tasks (board by status), Timeline View, All Details (table), Recurring Maintenance (filtered table), Cost Tracker (table by cost)

> **Schema note — Pool:** Pool maintenance tasks (opening, closing, winterizing) map to **Area: Exterior** or **Area: Garden** depending on the task. No separate "Pool" area exists in the schema — adding one is optional but would improve filtering. The AI classification prompt must be aware of this mapping.

> **Schema note — Type is multi_select:** A task can have multiple types (e.g., a bathroom renovation could be Plumbing + Carpentry + Painting). The form UI must use multi-select chips, not a single dropdown.

## Project Structure

```
tasktracker/
├── app/
│   ├── layout.tsx                  # Root layout, PWA meta, bottom nav shell
│   ├── page.tsx                    # Dashboard (RSC: server-fetches tasks)
│   ├── globals.css
│   ├── task/[id]/page.tsx          # Task detail / edit
│   ├── add/page.tsx                # Add new task (bottom-sheet style)
│   ├── calendar/page.tsx           # Calendar view with task dots
│   └── api/
│       ├── tasks/route.ts          # GET (list with filters), POST (create)
│       ├── tasks/[id]/route.ts     # GET, PATCH, DELETE
│       ├── ai/prioritize/route.ts  # Claude: reorder tasks by urgency
│       ├── ai/suggest/route.ts     # Claude: seasonal + missing task suggestions
│       ├── ai/classify/route.ts    # Claude Vision: photo → task classification
│       └── upload/route.ts         # Vercel Blob: photo upload endpoint
├── components/
│   ├── bottom-nav.tsx              # Fixed bottom tab bar
│   ├── task-card.tsx               # Task list item with priority + type badges
│   ├── task-form.tsx               # Shared create/edit form (multi-select for Type)
│   ├── task-filters.tsx            # Horizontal filter chips
│   ├── priority-badge.tsx          # Color-coded priority pill
│   ├── status-badge.tsx            # Status indicator with quick-toggle
│   ├── seasonal-banner.tsx         # "Pool opening season — 3 weeks away" alert
│   ├── ai-panel.tsx                # AI suggestions slide-up drawer
│   ├── camera-capture.tsx          # Camera capture + classification flow
│   ├── overdue-banner.tsx          # In-app overdue/due-soon alerts
│   └── calendar-view.tsx           # Month grid with colored task dots
├── lib/
│   ├── notion.ts                   # Notion client + typed CRUD helpers
│   ├── types.ts                    # Task interface matching all 14 properties
│   ├── ai.ts                       # Claude API helpers + prompt templates
│   ├── seasonal.ts                 # Seasonal rules for Saratoga Springs, NY
│   ├── cache.ts                    # In-memory cache with TTL (Notion rate-limit guard)
│   └── auth.ts                     # Simple shared-secret middleware
├── public/
│   ├── manifest.json               # PWA manifest
│   ├── sw.js                       # Service worker (app shell + static asset caching)
│   ├── icon-192.png
│   └── icon-512.png
└── .env.local
    # NOTION_API_KEY
    # NOTION_DATABASE_ID=1e670ce0-a955-804c-959e-d2d96602f4dd
    # ANTHROPIC_API_KEY
    # BLOB_READ_WRITE_TOKEN  (Vercel Blob for photo uploads)
    # APP_SECRET              (shared secret for API route auth)
```

## Key Screens

1. **Dashboard** (`/`) — Server-rendered task list, auto-sorted by AI (cached), filter chips (status / area / priority / type), seasonal banner at top, sort toggle (AI Smart / Due Date / Priority / Area), overdue alerts
2. **Task Detail** (`/task/[id]`) — Full edit form with all 14 fields, quick status toggle buttons (swipe or tap), cost comparison (estimate vs. actual), "Mark Complete" action (auto-fills Date Completed)
3. **Add Task** (`/add`) — Minimal form (Task name required, everything else optional with smart defaults). **Camera button** snaps a photo → Claude Vision auto-fills Type (multi-select), Area, Priority, Cost Estimate, and a suggested task name. User reviews and saves.
4. **Calendar** (`/calendar`) — Month grid, colored dots by priority, tap a day to expand task list. Supports date-range tasks (rendered as spans across days).

**Bottom Nav:** Tasks | Calendar | + Add | AI

## Seasonal/AI Prioritization

`lib/seasonal.ts` encodes rules for Saratoga Springs, NY (USDA Zone 4b/5a):

| Season Window | Tasks |
|---|---|
| Mar 25 – May 15 | Pool opening, equipment check |
| Apr 1 – May 1 | Spring cleanup, gutter cleaning, exterior inspection |
| April | AC service / HVAC tune-up |
| May – October | Lawn care (monthly mowing, fertilizing) |
| September | Furnace service / HVAC tune-up |
| Sep 15 – Oct 15 | Pool closing, winterizing |
| October | Gutter cleaning (fall), exterior paint touch-up |
| Oct 1 – Nov 1 | Winterize outdoor faucets, hose bibs |
| November | Check weatherstripping, insulation |

These rules are injected into the Claude prompt alongside the current task list and today's date. Claude returns:
- **Prioritized task order** with brief reasoning per task
- **Missing task suggestions** (seasonal items not yet in the database)

**AI behavior:**
- Auto-prioritize on dashboard load, **cached 1 hour server-side** (`lib/cache.ts`)
- Falls back to Due Date sort if Claude API is unavailable
- Manual sort toggle always available (Due Date / Priority / Area)
- Uses **Claude Sonnet** for cost efficiency (~$0.01-0.03 per prioritization call)

**Frequency-aware:** The Frequency field (Monthly, Quarterly, etc.) feeds into AI context so Claude can flag tasks that are past their recurring schedule (e.g., "Gutter cleaning is Quarterly — last completed 4 months ago").

## Implementation Phases

### Phase 1: Project Setup + Notion CRUD + PWA Shell
- Initialize Next.js 16 with TypeScript, Tailwind 4, App Router
- **PWA manifest + meta tags from day one** (enables mobile testing via "Add to Home Screen" immediately)
- Build `lib/types.ts` — `Task` interface mapping all 14 Notion properties, including:
  - `type: string[]` (multi_select — array, not single value)
  - `dueDate: { start: string; end?: string }` (date range support)
  - `frequency: "One-time" | "Monthly" | "Quarterly" | "Semi-annually" | "Annually"`
- Build `lib/notion.ts` — Notion client, `getTasks()`, `getTask()`, `createTask()`, `updateTask()`, `deleteTask()`
- Build `lib/auth.ts` — simple shared-secret check (`APP_SECRET` env var, validated via middleware on API routes)
- Build API routes: `/api/tasks` (GET with filter params, POST), `/api/tasks/[id]` (GET, PATCH, DELETE)
- Build Dashboard page as RSC — server-fetches tasks, renders `TaskCard` list
- Build bottom navigation
- **Verify:** See all Notion tasks in browser; add `?secret=xxx` or header-based auth working; PWA installable on phone

### Phase 2: Create + Edit + Filters
- Build `task-form.tsx` — shared create/edit form component
  - Multi-select chip picker for **Type** (not a dropdown — matches Notion's multi_select)
  - Date range picker for **Due Date** (start + optional end)
  - Select pickers for Status, Priority, Area, Frequency
  - "Mark Complete" button that sets Status=Completed + Date Completed=today
- Build Add Task page (`/add`)
- Build Task Detail/Edit page (`/task/[id]`) with quick status toggle
- Add horizontal filter chips on dashboard (Status, Area, Priority)
- Optimistic updates: update UI immediately, revert on Notion API error
- **Verify:** Full CRUD working; edit a task → change appears in Notion within seconds

### Phase 3: Mobile Polish
- Service worker for app shell + static asset caching (offline fallback page saying "Connect to manage tasks")
- Mobile CSS refinements: 44px+ touch targets, haptic-style feedback, smooth page transitions
- Toast notifications for CRUD actions (created/updated/deleted)
- Pull-to-refresh on task list
- Loading skeletons for initial data fetch
- **Verify:** Smooth, native-feeling experience on phone; fast repeat visits via cached shell

### Phase 4: AI Prioritization + Seasonal Awareness
- Build `lib/seasonal.ts` with Saratoga Springs seasonal rules table
- Build `lib/ai.ts` — Claude prompt templates, response parsing, error handling with graceful fallback
- Build `lib/cache.ts` — server-side in-memory cache with 1-hour TTL
- Build `/api/ai/prioritize` — accepts task list + date, returns ordered list with reasoning
- Build `/api/ai/suggest` — returns seasonal suggestions not yet in the database
- Dashboard: auto-sort by AI on load (cached), sort toggle for manual override
- Seasonal banner component: shows upcoming seasonal window (e.g., "Pool season starts in 3 weeks")
- AI suggestions slide-up drawer with "Add to Notion" action per suggestion
- **Verify:** Dashboard auto-sorts intelligently; seasonal banner appears at appropriate times; AI suggests missing tasks

### Phase 5: Camera + AI Photo Classification
- Build `/api/upload` route — accepts image, stores via **Vercel Blob**, returns URL
- Build `camera-capture.tsx` — uses `<input type="file" accept="image/*" capture="environment">` (native camera on mobile)
- Build `/api/ai/classify` — sends photo URL to Claude Vision with prompt:
  > "You are analyzing a photo of a home maintenance issue at a residential property in Saratoga Springs, NY. Classify this issue and return JSON: { task: string, type: string[] (from: Plumbing, Electrical, Painting, Carpentry, Cleaning, Landscaping, HVAC, General Repair), area: string (from: Kitchen, Bathroom, Bedroom, Living Room, Garage, Exterior, Garden, Roof, Laundry, Basement/Attic, Driveway/Walkway, Fence), priority: High|Medium|Low, costEstimate: number, description: string }"
- Integrate into Add Task: camera button → snap → uploading spinner → AI fills fields → user reviews/edits → save
- Photo URL stored in Notion page body (as an embedded image block)
- **Verify:** Take photo of a leaky faucet → AI returns Type: ["Plumbing"], Area: "Kitchen", Priority: "High", Cost: $150-300

### Phase 6: OpenClaw / Telegram Integration
- **In-app overdue alerts:** Banner on dashboard for overdue tasks + tasks due within 3 days
- **OpenClaw daily digest (Telegram):**
  - Create OpenClaw skill (SKILL.md) with Notion API access
  - Cron: daily at 8am EST, query Notion for tasks due ≤3 days + overdue + in-progress
  - Telegram message format: "Good morning! 3 tasks this week:\n• Pool opening (due Apr 10) 🔴\n• Gutter cleaning (due Apr 12) 🟡\n• HVAC service (overdue!) 🔴"
  - Max 1 message per day; skip if nothing due
- **OpenClaw chat-based task creation:**
  - Text: "add task: fix leaky kitchen faucet, high priority" → parses → creates in Notion
  - Photo: send photo via Telegram → OpenClaw runs Vision classification → creates task with AI-filled fields
- **OpenClaw seasonal proactive suggestions:**
  - Monthly cron: check seasonal rules against existing Notion tasks, suggest missing ones
  - "Spring reminder: Pool opening season starts in 2 weeks. Want me to create the task?"
  - User replies "yes" → task created in Notion
- **Verify:** Receive daily digest on Telegram; send photo → task created; seasonal suggestion arrives on schedule

### Phase 7: Calendar + Deploy + Final Polish
- Build calendar view — month grid with colored dots (red/yellow/green by priority)
- Date-range tasks render as multi-day spans
- Tap a day → expand to show that day's tasks inline
- Final deploy to Vercel with production env vars
- End-to-end smoke test on phone via production URL
- **Verify:** Full app working as installed PWA on phone via Vercel URL

## Critical Files

| File | Role |
|---|---|
| `lib/notion.ts` | Entire data layer; maps 14 Notion properties to/from TypeScript types |
| `lib/types.ts` | `Task` interface — single source of truth for the data shape |
| `lib/seasonal.ts` | Seasonal rules engine for Saratoga Springs |
| `lib/cache.ts` | Server-side TTL cache protecting Notion API rate limits |
| `lib/auth.ts` | Shared-secret auth middleware for API routes |
| `app/page.tsx` | Dashboard — the primary screen users interact with |
| `app/api/tasks/route.ts` | Main API bridge between frontend and Notion |
| `app/api/ai/prioritize/route.ts` | Claude-powered smart prioritization |
| `app/api/ai/classify/route.ts` | Claude Vision photo → task classification |
| `components/task-form.tsx` | Shared form component (must handle multi_select Type) |
| `components/camera-capture.tsx` | Camera integration for photo-to-task flow |

## Key Decisions

1. **No separate database** — Notion is the single source of truth. ~200-500ms latency per request, but zero sync complexity. Server-side caching mitigates repeat reads.
2. **Simple shared-secret auth** — Not "no auth." A single `APP_SECRET` env var checked by middleware on all API routes. Keeps random internet users out of your CRUD endpoints once deployed to Vercel. Can upgrade to proper auth later.
3. **No offline-first** — Service worker caches app shell + static assets only. Tasks always fetch live from Notion. Offline fallback page displays a friendly message.
4. **Claude Sonnet for AI** — Cost-effective for personal use (~$0.01-0.03/call for prioritization, ~$0.02-0.05/call for photo classification). Haiku is an option if costs need to drop further.
5. **Due Date supports ranges** — Notion schema has start+end dates. Calendar view renders these as multi-day spans. Form includes optional end date.
6. **Type is multi_select** — A task can have multiple types. UI uses tappable chips, not a single dropdown. AI classification returns an array.
7. **Camera uses native device capture** — `<input type="file" accept="image/*" capture="environment">` works on all mobile browsers without a library.
8. **Photo storage via Vercel Blob** — Notion's file upload API is limited and URLs expire. Vercel Blob provides permanent, fast URLs. Photos are also embedded in Notion page body for visibility in Notion itself.
9. **Notifications via OpenClaw + Telegram** — More reliable than browser Push API. Daily digest at 8am EST. In-app banners handle the rest.
10. **Frequency-aware AI** — The Frequency field is passed to Claude so it can flag overdue recurring tasks (e.g., "Quarterly gutter cleaning — last done 5 months ago").
11. **PWA from Phase 1** — Manifest and meta tags added on day one so mobile testing via "Add to Home Screen" works throughout development.
12. **Server-side caching** — `lib/cache.ts` with configurable TTL (1hr for AI results, 5min for task lists) protects against Notion's 3 req/s rate limit and keeps the app fast.

## Notion Setup Required

1. Create a Notion integration at https://www.notion.so/my-integrations
2. Share the "Braim Rd Maintenance" database with the integration
3. Copy the integration token → `NOTION_API_KEY` in `.env.local`
4. Database ID is `1e670ce0-a955-804c-959e-d2d96602f4dd` → `NOTION_DATABASE_ID` in `.env.local`
5. **(Optional)** Add "Pool" as an Area option in Notion for cleaner filtering of pool tasks

## Environment Variables

```
NOTION_API_KEY=secret_...           # Notion integration token
NOTION_DATABASE_ID=1e670ce0-a955-804c-959e-d2d96602f4dd
ANTHROPIC_API_KEY=sk-ant-...        # Claude API key
BLOB_READ_WRITE_TOKEN=vercel_...    # Vercel Blob for photo uploads
APP_SECRET=<random-string>          # Shared secret for API auth
```

## Verification Checklist

1. Run `npm run dev`, open on phone via local network
2. View tasks — all Notion tasks render with correct properties (including multi-select Type)
3. Add a task — appears in Notion database within seconds
4. Edit a task status — updates in Notion; "Mark Complete" sets Date Completed
5. Filter by Area + Priority — correct tasks shown
6. AI Smart Sort — tasks reorder with seasonal awareness; reasoning visible
7. AI Suggest — seasonal suggestions appear; can add to Notion with one tap
8. Install as PWA on phone — standalone, smooth, fast repeat loads
9. Take photo of maintenance issue — AI classifies correctly, pre-fills form
10. Deploy to Vercel — full flow works via production URL with auth
11. Receive daily digest on Telegram via OpenClaw
12. Send photo via Telegram → task auto-created in Notion with AI classification
13. Calendar view — tasks on correct dates, date ranges span multiple days

---

## Future Plan: Reimagining OpenClaw as Capture + Concierge + Memory

**Status:** Strategic plan, not yet implemented. Saved 2026-04-10.

### The Insight

Most home maintenance apps fail at data entry friction. The web app is great at *output* (lists, calendar, AI plans, ROI tracking) but every feature needs you to be in the app navigating screens. OpenClaw shouldn't be a duplicate of the web app in chat form — it should be the **always-on capture layer the web app can't be**. The web app is where you *think and plan*. OpenClaw is where you *react in the moment*.

### Three Roles (Replaces the Current SKILL.md Framing)

**Role 1 — The Capture Inbox (replaces "quick add")**
- Voice-first capture: voice note → GPT-4o transcription → classify → task
- Photo dumps: send 5 photos at once during a walk-around → 5 separate tasks
- "Remind me when..." natural language → task with due date
- Brain-dump mode: paragraph form → split into multiple tasks
- Contractor quote capture: forward a text/photo → attach to relevant task or wish list item

**Role 2 — The Proactive Concierge (replaces "daily digest" + "seasonal")**
Send messages only when there's *signal*, not on a fixed cron. Silence is a feature. Target 3-5 messages per week max.

| Trigger | Example message |
|---------|-----------------|
| Weather + outdoor task | "Rain Sunday — 'clean gutters' is due Saturday. Bump to Friday?" |
| Cold snap incoming | "Temps dropping to 18°F Thursday. You haven't winterized the outdoor faucet yet." |
| Lawn mowing weather window | "Dry and 65°F all weekend — perfect mowing window. You're due." |
| Overdue bundling (weekly, not daily) | "3 tasks overdue this week. Roll them into Saturday?" |
| Wish list spotlight (Sunday) | "💭 Belgium block driveway border. Best season: now. Hired $4,800, DIY $1,200 — save $3,600. Start it?" |
| Seasonal arrival | "Pool opening window starts in 2 weeks. 4 prep tasks not on your calendar. Add them?" |
| Stale wish list | "You haven't looked at 'replace front door' in 6 months. Still want it, archive, or schedule?" |

**Role 3 — The Hands-Free Query Layer (entirely new)**
Turn 2 years of accumulated data into queryable memory.
- "what's overdue?"
- "how much have I spent on the kitchen this year?"
- "what's my wish list total?" → "$47,300 across 12 projects, $18,200 if you DIY everything"
- "what color is the master bedroom?" → looks up paint tracker, returns Behr 3A60-3 + colorant formula
- "what did I do last spring?" → completed tasks Apr-Jun previous year
- "when did I last service the AC?"
- "who painted the porch?" → contractor name from task notes

### Strategic Differentiators (vs. competing apps)

1. **Voice-first capture for home maintenance** — no competing app does this
2. **Smart proactive layer** combining weather + season + your actual data (no IoT sensors needed)
3. **Queryable home memory** — once seeded with a year of data, becomes your home's history
4. **Wish list ROI integration in nudges** — combines "season is now" + ROI + DIY savings into one push

### What OpenClaw Should NOT Be

- Don't replicate the calendar (web app does this well)
- Don't replicate full task editing (set status/priority/date — yes; multi-field forms — no)
- Don't be a daily digest machine (be selective, earn your messages)
- Don't try to fully replace the web app — they should feel like a team

### Architecture

```
                  [Notion DBs]
                       |
        +--------------+--------------+
        |              |              |
   [Web App]      [OpenClaw]    [Vercel APIs]
        |              |              |
    Plan deeply    React fast    Shared logic
    Browse data    Capture       AI endpoints
    Detail edits   Query/recall  Weather/cron
```

OpenClaw should call the existing `/api/ai/plan-project`, `/api/tasks`, `/api/wishlist` endpoints rather than re-implementing logic. Single source of truth for ROI math, AI prompts, and schema. Schema changes propagate automatically. Future Postgres migration won't break OpenClaw.

The only new dependency OpenClaw needs is a **weather API** (recommend National Weather Service — free, no key, US-only is fine for Saratoga Springs).

### Roadmap (4 phases)

**Phase 1 — Capture & Query (Week 1) — START HERE**
1. Voice → task (Telegram voice → GPT-4o transcription → existing classify endpoint)
2. Photo → task (use web app's `/api/ai/classify` instead of duplicating)
3. Multi-task brain dump (split paragraphs into separate tasks)
4. Query commands ("overdue?", "this week?", "wish list total?", "last AC service?")
5. Quick status updates ("done: faucet" finds matching task and marks complete)

**Phase 2 — Proactive Concierge (Week 2)**
6. Weather watcher cron (daily, 1 batched message if actionable)
7. Cold snap detector (first hard freeze vs. winterize tasks)
8. Weekend window finder (dry/mild weekend → outdoor backlog)
9. Bundled overdue digest (weekly, not daily — group with "schedule for Saturday?" prompt)

**Phase 3 — Wish List & Memory (Week 3)**
10. Weekly wish list spotlight (Sunday, picks current-season item with ROI/savings)
11. Wish list quick capture ("wish: rebuild back deck" → calls plan-project API)
12. Promote to task from chat ("start: belgium border")
13. History queries ("kitchen costs this year?", "when did I paint the porch?")

**Phase 4 — Polish (Week 4+)**
14. Contractor quote attachment (forward → "attach to which task?")
15. Paint tracker queries ("what color is master bedroom?")
16. End-of-year summary (Jan 1: tasks completed, $ spent, wish list projects done, DIY savings)

### Open Questions Before Implementation

1. **Weather API** — NWS (recommended, US-only, no key) or OpenWeatherMap (1000/day free)?
2. **OpenClaw scheduler** — Does OpenClaw have its own cron, or does Vercel need to trigger it?
3. **Message budget** — Confirm 3-5 messages/week max (avoid notification fatigue)
4. **Phase order** — Recommend Phase 1 first (high daily utility, builds foundation for Phase 2)
5. **API access** — Does OpenClaw have `NEXT_PUBLIC_APP_SECRET` to call Vercel APIs?

### Sources Used in Research

- Predictive Maintenance 2026 (Kukun)
- AI for Home Services (ServiceTitan)
- Homeowner AI (HomeZada)
- AI Weather Preparation Advisor (Taskade)
- Proactive Future Rain Notifications with Home Assistant (Brent Saltzman)
- 12 Best Home Maintenance Apps (HomeLight)
- Home Maintenance Reminders pain points forum (HouseRepairTalk)
- AI-Powered Telegram Task Assistant with Notion Integration (n8n)
- New Home Maintenance Integration (Home Assistant Community)
