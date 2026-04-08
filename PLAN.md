# TaskTracker - Home Maintenance Mobile Web App

## Context

You have a well-structured Notion database ("Braim Rd Maintenance") with 13 properties and 6 views for tracking home maintenance. But Notion on mobile is clunky for quick task management. You want a fast, phone-friendly PWA to view/add/update tasks with AI-powered prioritization that understands seasonal needs (like pool opening in Saratoga Springs).

**Existing apps researched:** HomeZada (comprehensive but complex), Evergreen Home (simple + DIY guides), Centriq (appliance-focused), BrightNest (educational). Our app takes the best of Evergreen Home's simplicity + AI prioritization that none of them do well.

## Architecture

**Notion as the backend.** No separate database. Your existing data stays in Notion, the app is a mobile-optimized frontend that reads/writes via Notion API through Next.js API routes (keeps API keys server-side).

```
Phone (PWA)      → Next.js on Vercel → Notion API + Claude API   (view/edit/dashboard)
Phone (WhatsApp) → OpenClaw           → Notion API               (quick add/update via chat)
                   OpenClaw Cron      → Notion API → Messaging   (daily notifications + proactive suggestions)
```

**OpenClaw** (self-hosted at `http://187.77.18.160:61493`) handles notifications, quick chat-based task creation, and proactive seasonal suggestions — complementing the web app.

## Tech Stack

- **Next.js 16** (App Router) + **React 19** + **Tailwind 4**
- **@notionhq/client** for Notion API
- **@anthropic-ai/sdk** for Claude AI prioritization
- **Radix UI** for accessible components
- **Lucide React** for icons
- **date-fns** for date handling
- **PWA** manifest + service worker for phone installability
- **Vercel** for deployment

## Project Structure

```
TaskTracker/
├── app/
│   ├── layout.tsx              # Root layout + bottom nav + PWA meta
│   ├── page.tsx                # Dashboard: task list + filters + seasonal banner
│   ├── globals.css
│   ├── task/[id]/page.tsx      # Task detail / edit
│   ├── add/page.tsx            # Add new task (bottom-sheet style)
│   ├── calendar/page.tsx       # Calendar view with task dots
│   └── api/
│       ├── tasks/route.ts      # GET (list), POST (create)
│       ├── tasks/[id]/route.ts # GET, PATCH, DELETE
│       ├── ai/prioritize/route.ts  # Claude: reorder tasks smartly
│       ├── ai/suggest/route.ts     # Claude: suggest missing tasks
│       ├── ai/classify/route.ts    # Claude Vision: photo → task classification
│       └── notifications/route.ts  # Check due/overdue tasks for push
├── components/
│   ├── bottom-nav.tsx          # Fixed bottom tab bar (Tasks, Calendar, +Add, AI)
│   ├── task-card.tsx           # Task list item with priority badge
│   ├── task-form.tsx           # Shared create/edit form
│   ├── task-filters.tsx        # Horizontal filter chips
│   ├── priority-badge.tsx      # Color-coded pill
│   ├── status-badge.tsx        # Status indicator
│   ├── seasonal-banner.tsx     # "Pool opening in 3 weeks" alert
│   ├── ai-panel.tsx            # AI suggestions drawer
│   ├── camera-capture.tsx      # Camera capture + AI classification
│   ├── notification-banner.tsx # In-app due/overdue alerts
│   └── calendar-view.tsx       # Month grid with colored dots
├── lib/
│   ├── notion.ts               # Notion client + CRUD helpers
│   ├── types.ts                # Task interface + enums
│   ├── ai.ts                   # Claude API helpers
│   ├── seasonal.ts             # Seasonal rules for Saratoga Springs
│   └── utils.ts                # Shared utilities
├── public/
│   ├── manifest.json           # PWA manifest
│   ├── sw.js                   # Service worker (app shell caching)
│   ├── icon-192.png
│   └── icon-512.png
└── .env.local                  # NOTION_API_KEY, NOTION_DATABASE_ID, ANTHROPIC_API_KEY
```

## Key Screens

1. **Dashboard** (`/`) — Scrollable task list auto-sorted by AI on load, filter chips (status/area/priority), seasonal banner at top, FAB for quick add, sort toggle (AI / Due Date / Priority / Area)
2. **Task Detail** (`/task/[id]`) — Full edit form, quick status toggle buttons, cost section, "Mark Complete" button
3. **Add Task** (`/add`) — Minimal form (only task name required), smart defaults, area/type dropdowns from Notion schema. **Camera button** to snap a photo of an issue — Claude Vision analyzes the image and auto-fills Type, Area, Priority, and a cost estimate. Review and save.
4. **Calendar** (`/calendar`) — Month grid, colored dots for task priority, tap day to see tasks

**Bottom Nav:** Tasks | Calendar | + Add (with camera) | AI Suggestions

## Seasonal/AI Prioritization

`lib/seasonal.ts` has hardcoded rules for Saratoga Springs, NY (Zone 4b/5a):
- Pool opening: March 25 - May 15
- Pool closing/winterize: Sept 15 - Oct 15
- Spring cleanup: April 1 - May 1
- HVAC service: April (AC) and September (furnace)
- Gutter cleaning: April + October
- Winterize faucets: Oct 1 - Nov 1
- Lawn care: May - October

These rules feed into the Claude AI prompt along with the current task list. Claude returns tasks reordered by urgency with reasoning.

**AI behavior:** Auto-prioritize on every page load (cached for 1 hour so it's fast on repeat visits). Users can switch to manual sort (by date, priority, area) if they want a different view. Uses **Claude Sonnet** (not Opus) for cost efficiency.

**Pool is at Braim Rd** — pool opening/closing tasks are part of the seasonal rules for this property.

## Implementation Phases

### Phase 1: Project Setup + Notion CRUD
- Initialize Next.js project with TypeScript + Tailwind + App Router
- Build `lib/notion.ts` — Notion client, `getTasks()`, `getTask()`, `createTask()`, `updateTask()`
- Build `lib/types.ts` — `Task` interface mapping all 13 Notion properties
- Build API routes: `/api/tasks` (GET/POST), `/api/tasks/[id]` (GET/PATCH)
- Build Dashboard page with TaskCard list (read-only)
- Build bottom navigation
- **Verify:** See all Notion tasks in the browser

### Phase 2: Create + Edit + Filters
- Build `task-form.tsx` shared component
- Build Add Task page
- Build Task Detail/Edit page with quick status toggle
- Add filter chips on dashboard
- **Verify:** Full CRUD working, changes appear in Notion

### Phase 3: PWA + Mobile Polish
- Add PWA manifest + service worker
- Add PWA meta tags to layout
- Mobile CSS refinements (44px+ touch targets, smooth transitions)
- Toast notifications for actions
- Pull-to-refresh on task list
- **Verify:** Install as PWA on phone, smooth experience

### Phase 4: AI Prioritization
- Build `lib/ai.ts` + `lib/seasonal.ts`
- Build `/api/ai/prioritize` and `/api/ai/suggest` routes
- Auto-prioritize task list on dashboard load (cached 1 hour)
- Add sort toggle: AI Smart Sort / Due Date / Priority / Area
- Add seasonal banner component
- Add AI suggestions panel
- **Verify:** Dashboard auto-sorts by AI, seasonal suggestions appear, can switch to manual sort

### Phase 5: Camera + AI Classification
- Build `camera-capture.tsx` — uses device camera via `<input type="file" capture="environment">`
- Build `/api/ai/classify` route — sends photo to Claude Vision, returns { type, area, priority, costEstimate, description }
- Integrate into Add Task flow: camera button → snap photo → AI auto-fills fields → user reviews → save
- Photo stored as a URL in Notion page content (uploaded via Notion API)
- **Verify:** Take photo of a maintenance issue, AI correctly classifies and estimates cost

### Phase 6: OpenClaw Integration + Notifications
- **In-app alerts:** On dashboard load, show banners for overdue tasks and tasks due within 3 days
- **OpenClaw notifications (replaces Web Push complexity):**
  - Create OpenClaw skill (SKILL.md) for TaskTracker Notion queries
  - Set up cron job: daily at 8am, query Notion for tasks due within 3 days + overdue
  - Send digest via Telegram (user's preferred platform)
  - Example message: "Good morning! 3 tasks this week: Pool opening (due Apr 10), Gutter cleaning (due Apr 12), HVAC service (overdue)"
  - Never more than 1 message per day
- **OpenClaw quick-add via chat:**
  - Send OpenClaw a message like "add task: fix leaky kitchen faucet, high priority" → creates Notion entry
  - Send a photo via chat → OpenClaw classifies with vision → creates task with type, area, cost estimate
- **OpenClaw seasonal proactive suggestions:**
  - Monthly cron: OpenClaw checks seasonal rules for Saratoga Springs, suggests tasks not yet in Notion
  - Example: "Spring reminder: Have you scheduled gutter cleaning and AC tune-up?"
- **Verify:** Receive daily digest on phone via messaging; send photo via chat and see task created in Notion

### Phase 7: Calendar + Final Polish
- Build calendar view
- Add sorting options
- Loading skeletons + optimistic updates
- Deploy to Vercel
- **Verify:** Full app working on phone via Vercel URL

## Critical Files

- `lib/notion.ts` — Entire data layer; maps 13 Notion properties to/from TypeScript
- `app/api/tasks/route.ts` — Main API bridge between frontend and Notion
- `app/page.tsx` — Dashboard, the primary screen users interact with
- `lib/seasonal.ts` — Seasonal rules engine for Saratoga Springs
- `app/api/ai/prioritize/route.ts` — Claude-powered smart prioritization
- `app/api/ai/classify/route.ts` — Claude Vision photo analysis
- `components/camera-capture.tsx` — Camera integration for photo-to-task

## Key Decisions

1. **No separate database** — Notion is the single source of truth. Slightly higher latency (~200-500ms) but zero sync complexity
2. **No auth for v1** — Personal app. Can add password middleware later if needed
3. **No offline-first** — Service worker caches app shell only. Tasks always fetch live from Notion
4. **Claude Sonnet for AI** — Cost-effective for personal use
5. **Date ranges for seasonal tasks** — Notion schema already supports start+end dates
6. **Camera uses device native capture** — `<input type="file" accept="image/*" capture="environment">` works on all mobile browsers, no library needed
7. **Notifications via OpenClaw + messaging** — more reliable than browser push. Daily digest at 8am via Telegram. In-app alerts handle the rest.
8. **OpenClaw for chat-based task management** — quick-add tasks and send photos for classification via messaging, without opening the web app

## Notion Setup Required

1. Create a Notion integration at https://www.notion.so/my-integrations
2. Share the "Braim Rd Maintenance" database with the integration
3. Copy the integration token to `.env.local`

## Verification

1. Run `npm run dev`, open on phone via local network
2. View tasks — should show all tasks from Notion
3. Add a task — should appear in Notion database
4. Edit a task status — should update in Notion
5. Tap "AI Prioritize" — tasks reorder with seasonal awareness
6. Install as PWA on phone — should work as standalone app
7. Deploy to Vercel — test full flow on phone via public URL
8. Take photo of a maintenance issue — AI classifies correctly and pre-fills task
9. Receive daily digest via messaging (OpenClaw)
10. Send photo via Telegram to OpenClaw → task auto-created in Notion
