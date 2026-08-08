# Zavu Inbox

Open source business phone and shared inbox, built on the [Zavu](https://zavu.dev) API.

Your team gets one place to answer customers across SMS, WhatsApp, Email, Telegram, Instagram and Messenger, with the collaboration layer a shared inbox actually needs: assignment, open/done, internal notes, saved replies, tasks and scheduled messages. Numbers, delivery, compliance and AI agents are handled by Zavu.

Self-hosted, Apache-2.0. Bring your own Zavu API key.

## What it does

| | |
|---|---|
| **Shared inbox** | Every channel in one thread per contact. Filters for open, assigned to me, unassigned, done. Live updates over SSE. |
| **Collaboration** | Assign to a teammate, mark done, snooze, write internal notes with `@mentions`, none of which the contact ever sees. |
| **Saved replies** | Type `/shortcut` in the composer. Private or shared with the workspace. |
| **Tasks** | Standalone, or attached to a conversation. |
| **Scheduled messages** | Queue a message for later; a one-minute ticker sends it. |
| **Contacts** | Zavu's record plus your own notes and custom properties. |
| **Calls** | Calls handled by your Zavu voice agent, with full transcripts. |
| **AI agents** | See what answers for you, and dry-run a prompt without sending anything. |
| **Business hours** | Per inbox, in its own timezone, with an out-of-hours auto-reply sent once per closed period. |

## What it does not do yet

**Human calling.** There is no softphone: you cannot pick up a call in the browser. Zavu's voice channel today is an AI agent that answers, so Zavu Inbox shows those calls and their transcripts but does not place or receive human ones. Call flows (IVR menus, ring groups, voicemail boxes, transfer, hold, conference) are not implemented either. That work needs new voice endpoints in the Zavu API and is tracked as phase two.

## Requirements

- A Zavu account with at least one sender ([dashboard.zavu.dev](https://dashboard.zavu.dev))
- Docker, or Node 24 for local development

No database server is required. See [Database](#database) below.

## Quick start

```bash
git clone https://github.com/zavudev/zavu-inbox
cd zavu-inbox
cp .env.example .env
```

Fill in `.env`:

- `ZAVU_API_KEY` from the Zavu dashboard
- `ZAVU_WEBHOOK_SECRET` from the sender whose webhook you will point here
- `CRON_SECRET`, any random string: `openssl rand -hex 32`

Then:

```bash
docker compose up
```

Open http://localhost:4100. The first screen creates the owner account and imports your existing conversations, contacts and senders from Zavu.

## Database

The backend is chosen by the shape of `DATABASE_URL`, and that is the only thing you change to switch:

| `DATABASE_URL` | Backend | When |
|---|---|---|
| `file:/data/zavu-inbox.db` | SQLite file | Default. No server, no cost, fine for a team-sized inbox. |
| `libsql://<db>.turso.io` | Turso | Managed and cheap. Also set `DATABASE_AUTH_TOKEN`. |
| `postgres://…` | Postgres | You already run one and would rather keep a single backup story. |

Postgres brings its own container:

```bash
docker compose -f docker-compose.yml -f docker-compose.postgres.yml up
```

Both dialects have their own Drizzle schema (`lib/db/schema/sqlite.ts` and `lib/db/schema/pg.ts`) and their own migrations. They are required to describe identical rows, and `lib/db/schema/parity.test.ts` compares table names, column names, nullability, primary keys and defaults on every test run: add a column to one and the suite fails before the difference can reach production on whichever backend you were not running.

The handful of things SQL does not agree on live in `lib/db/dialect.ts`: case-insensitive search (`ILIKE` versus `LIKE`) and "does this JSON array contain this value" (`@>` versus a quoted-needle `LIKE`). Nothing else in the app knows which backend it is talking to.

### Point Zavu at your instance

In the Zavu dashboard, set each sender's webhook URL to:

```
https://your-domain/api/webhooks/zavu
```

Subscribe to `message.inbound`, `message.sent`, `message.delivered`, `message.read`, `message.failed` and `conversation.new`. Without this the inbox only updates when someone reloads.

## Local development

```bash
npm install
npm run db:migrate    # creates ./zavu-inbox.db, no server needed
npm run db:seed       # optional: demo threads, so you can click around
npm run dev
```

After changing a schema, regenerate both dialects so they cannot drift:

```bash
npm run db:generate
```

Runs on port 4100.

To receive webhooks on a laptop, expose the port with a tunnel (`cloudflared tunnel --url http://localhost:4100`) and use that hostname in the Zavu dashboard.

## How it fits together

Zavu is the source of truth for messages, contacts, numbers and senders. Zavu Inbox stores only what Zavu does not know about: your users, and what they did to a thread.

```
Contact ──> Zavu (delivery, compliance, AI) ──webhook──> Zavu Inbox ──> your database
                        ^                                   │      (SQLite, Turso or Postgres:
                        └────────── REST API ───────────────┘       workspace state only)
```

The one thing mirrored locally is the conversation row, because an inbox has to sort by last activity while filtering on assignee and status at the same time, and those live on opposite sides of the network. The mirror is a cache: every row can be rebuilt from `GET /v1/conversations`, and Settings has a re-sync button that does exactly that.

There is no privileged path here. This app has exactly the access you do: the same public API, the same documented webhooks, the same rate limits. That is deliberate, and it is the reason the project is worth reading. If something turns out to be hard to build in here, it is hard for everyone building on Zavu, and the fix belongs in the API.

### Layout

```
app/
  (app)/            inbox, contacts, calls, tasks, settings
  (auth)/           login, first-run setup
  api/webhooks/     Zavu webhook receiver, HMAC verified
  api/events/       SSE stream for live updates
  api/cron/         scheduled message sender
lib/
  zavu/             typed API client and webhook verification
  db/schema/        one schema per dialect, plus the parity test that binds them
  db/dialect.ts     the only place that knows which backend is running
  actions/          server actions (the collaboration layer)
  sync.ts           Zavu to local mirroring
```

## Security notes

- Webhook deliveries are verified with HMAC-SHA256 and rejected if older than 5 minutes. Both Zavu signature schemes are accepted: `v2` (the current one, which signs `{timestamp}.{body}` so the freshness window actually resists replay) and `v1` (body only, which older receivers stay on). A header carrying both is verified against `v2`.
- Session tokens are stored hashed, so a database dump cannot be replayed as a login.
- Passwords use scrypt from the Node standard library. No native modules, no compiler at install time.
- The Zavu API key lives in the environment and is never written to the database or sent to the browser.

## Contributing

Issues and pull requests are welcome. Three invariants this codebase leans on, all easy to break by accident:

1. **Everything on the Zavu side goes through the documented public API.** This app is a pure API client and stays one. If you need something the API does not expose, that is a gap worth an issue rather than something to route around, and the API getting better is the point of this project existing.
2. **A sync must never overwrite workspace state.** Assignment, status, notes, tasks and snippets exist only here; Zavu knows nothing about them. If a code path can silently unassign a thread because an update arrived, that is a bug, not a merge conflict.
3. **Schema changes land in both dialects.** `lib/db/schema/parity.test.ts` compares the SQLite and Postgres schemas column by column and will fail the build if you touch only one. That is deliberate: the alternative is a bug that only appears on the backend you were not running.

## License

Apache-2.0. Self-host it, change it, sell what you build with it. Keep the license and the NOTICE, and say what you changed.

Section 6 does not grant rights to the Zavu name: fork it freely, and give the fork its own name.
