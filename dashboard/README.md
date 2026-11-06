# Harbor & Pine support workspace

React, TypeScript, and Vite dashboard for the existing FastAPI support service.

## Run locally

From the project root, start the API:

```powershell
uv run fastapi dev app/main.py
```

Then, in `dashboard/`:

```powershell
npm install
npm run dev
```

The Vite server proxies `/api` to `127.0.0.1:8000`. Sign in using the dashboard
credentials configured in the root `.env`. Inbox checks use the existing live
poll endpoint and can send support replies. They run only when requested.

## Checks

```powershell
npm run lint
npm test
npm run build
```

Interaction tests use an isolated DOM and mock API responses; they do not read or
write your real support data. The production build is served by FastAPI from
`dashboard/dist`.

## Workspace behavior

- Activity summaries cover the latest 100 events, rather than a daily total.
- Event subjects and conversation links come from saved messages and tickets.
  Messages without a saved conversation show “Subject unavailable”.
- Activity icons open the linked ticket and focus the exact message. Shareable
  links use `#tickets?ticket=10&message=21`; direct ticket lookups also support
  tickets outside the latest 100 conversations. No database migration is needed.
- Conversation history is read-only. Article edits use the existing knowledge
  update endpoint, with confirmation before discarding unsaved changes.
- Light and dark themes are available from the top bar. The sidebar becomes a
  keyboard-accessible drawer on small screens. Motion respects the device’s
  reduced-motion preference.
