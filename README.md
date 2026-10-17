# Braim Rd household tasks

A Next.js app for home maintenance and project ideas, backed by your existing Notion databases. The opening view is a small, chosen plan; the full backlog and optional cost comparisons remain available when needed.

## Development

```sh
npm ci
npm run dev
```

The app runs at http://localhost:3000. Use Node.js 22 or 24. Before changing framework conventions, read the installed Next.js documentation referenced by AGENTS.md.

Configure these existing deployment variables in a local `.env.local` when connecting your own services. Never commit real values:

- `NOTION_API_KEY` and `NOTION_DATABASE_ID`: Notion integration and task database shared with it.
- `NOTION_FEATURES_PAGE_ID`: optional parent page for home records and wishlist databases.
- `OPENAI_API_KEY`: optional AI photo classification and project guidance. Ordinary capture and the daily plan work without AI.
- `BLOB_READ_WRITE_TOKEN`: photo storage. `BLOB_PUBLIC_HOST` optionally specifies the exact public Blob host if it cannot be derived from the token. The image optimizer is restricted to that store and the app's photo paths. Known legacy Notion/Blob photos use a browser-side fallback.
- `APP_SECRET` / `NEXT_PUBLIC_APP_SECRET`: existing shared-header compatibility. If enabled, their values must match. The public variable is visible in client code and is not a user login or privacy boundary; household access should be controlled at the hosting layer.

## Planning and records

- Dates are optional **Plan for** targets. Only the optional **Firm deadline** setting produces overdue warnings.
- Unstarted optional repeats scheduled for later sit under **Upcoming repeats**. Past targets, ongoing work, and firm deadlines remain visible. Completing a future repeating occurrence requires a specific early-completion confirmation.
- Completion removes the active card and explains the next repeat date. Late maintenance skips missed periods, keeping the original calendar anchor; deliberately entered historical completion dates retain their historical schedule. Saved completions awaiting recurrence recovery remain linked under **Repeats needing attention**.
- Up to three tasks can be selected for a plan. Time preferences, selections, skipped suggestions, and duration overrides are stored on that browser/device, not synced across household devices.
- Spending uses recorded actual costs. Undated costs remain visible but are excluded from period totals. Estimates and wishlist ideas are separate comparisons, never an automatic monthly reserve.
- Photos are resized before transfer; one upload can also produce suggestions. Failed analysis retains the attachment and can be retried without another upload.
- The first successful task write adds missing Notion checkbox/date/text properties for deadlines and retry recovery. The integration needs permission to update database properties. Reading the task list does not migrate the schema.

## Verification

```sh
npm run lint
npm test
npm run build
```

Tests use mocked external services. They cover input validation, failed saves, attachments, month-end recurrence, pagination/cache behavior, completion history, planner behavior, and wishlist promotion. They do not write to production Notion, Blob, or OpenAI.

Recurrence and wishlist promotion keep a persisted source identity and retry intent to recover ordinary retries and lost responses. Requests for the same task are serialized within one server process. Notion does not provide a cross-instance unique constraint or transaction; strict exactly-once creation across simultaneous server instances is not guaranteed.

Task lists deduplicate simultaneous reads but do not retain a process-local snapshot between requests. This prevents another Vercel instance from serving an old list after a task has changed. AI result caches remain separate.

The service worker caches the static shell. Offline navigation shows an explicit offline page; it never substitutes HTML for API JSON or presents stale cached pages as newly saved work.
