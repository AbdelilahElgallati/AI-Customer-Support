# Setup and operations

This guide documents the application in this checkout. For a product overview,
screenshots, and architecture, start with the [README](../README.md).

## Local requirements

Use Python 3.13 or newer, `uv`, and a Node.js version supported by the installed
Vite release. Install the locked frontend dependencies with `npm ci`. The full
integration path also requires Gmail OAuth access, PostgreSQL/Supabase, a Groq
key, and access to models compatible with the configured agents.

All Python commands below run from the repository root unless noted otherwise.
The default `uv sync` includes the development dependency group, which supplies
the OAuth helper and live evaluation dependencies.

## Configuration

Copy `.env.example` to `.env`, then fill in your own integration values. The
application loads this file before initializing the model clients.

| Setting | Purpose | Default in application code |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Required |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | Required |
| `GOOGLE_REFRESH_TOKEN` | Refresh token for the connected Gmail account | Required |
| `DATABASE_URL` | PostgreSQL connection URI, including required SSL options | Required |
| `GROQ_API_KEY` | Provider credential read by the Groq model integration | Required for model requests |
| `CLASSIFIER_MODEL` | Topic/language/handoff classifier | `groq:openai/gpt-oss-20b` |
| `AGENT_MODEL` | Tool-using support response agent | `groq:qwen/qwen3.8-27b` |
| `POLL_INTERVAL_SECONDS` | Delay after each polling iteration | `60` |
| `GMAIL_TIMEOUT_SECONDS` | Gmail and OAuth transport timeout | `15` |
| `AI_REQUEST_INTERVAL_SECONDS` | Minimum model-request spacing, per wrapper/process | `30` |
| `DASHBOARD_USERNAME` | Single workspace login name | `admin` |
| `DASHBOARD_PASSWORD` | Single workspace password | Empty; login is rejected until set |
| `PYDANTIC_AI_NO_BANNER` | Optional library banner suppression | Set to `1` in the example file |

The example file sets the polling interval to 30 seconds, overriding the
application’s 60-second default. Request spacing is local to each process; it
does not coordinate quota across multiple workers, evaluations, or deployments.

Model availability and provider quotas depend on the account. Choose replacement
models deliberately: the classifier needs native structured output, while the
support agent needs tool calling and must work with its structured draft parser.
Do not assume every model accepts the same model-specific settings.

## Gmail authorization

1. Enable the Gmail API in a Google Cloud project.
2. Configure the OAuth consent screen for your intended access. When using test
   mode, include the demo mailbox as a test user.
3. Create a desktop OAuth client and save the downloaded client JSON as
   `credentials.json` in the repository root.
4. Run:

   ```powershell
   uv run python scripts/get_refresh_token.py
   ```

5. Complete the browser authorization for the demo mailbox. Copy the printed
   client ID, client secret, and refresh token into your local `.env`.

The helper requests `https://www.googleapis.com/auth/gmail.modify`. Keep its
terminal output, `.env`, and `credentials.json` private. Use a dedicated inbox
for experiments: the live poller can send replies and apply labels.

Read-only verification:

```powershell
uv run python -m app.gmail
```

This refreshes OAuth as needed and reads the Gmail profile. It does not create
labels, process messages, or send email. The full `Gmail()` client used during
polling also ensures that the `ai-processed` and `needs-human` labels exist.

## Database and knowledge

Apply [the schema](../supabase/migrations/20261104180138_create_tables.sql) to your
Supabase database, then configure `DATABASE_URL` for a PostgreSQL role permitted
to perform the application’s operations. The schema enables row-level security;
the backend’s PostgreSQL access must have suitable permissions. Browser clients
do not connect directly to Supabase.

Seed the included articles:

```powershell
uv run python -m scripts.seed_knowledge_base
```

The script splits Markdown files at `##` headings. A filename becomes a section,
each heading becomes an article title, and the following text becomes content.
Rows are upserted on `(section, title)`.

Expected sections:

- `brand-and-tone`
- `escalation-rules`
- `paddle-boards`
- `shelving`
- `shipping`
- `returns-and-warranty`

The agent reads complete sections through `list_sections` and `get_section`.
There is no vector index, embedding pipeline, PDF ingestion, or similarity-search
service in the current implementation.

After initial seeding, dashboard edits update the database, not the Markdown
files. Re-seeding can replace those edits with file content. The repository is
the initial seed; the database is the runtime knowledge source.

## Run the application

API, terminal one:

```powershell
uv run fastapi dev app/main.py
```

Frontend, terminal two:

```powershell
cd dashboard
npm ci
npm run dev
```

Use the Vite URL and the credentials in `.env`. The API defaults to port 8000.
The Vite proxy targets `127.0.0.1:8000`; adjust it if you intentionally change
the backend port.

Read-only integration preflight:

```powershell
uv run python -m app.preflight
```

This checks required settings, knowledge sections, Gmail profile access, and AI
agent initialization. It does **not** make an inference request, so it does not
prove that the provider accepts the configured model or has remaining quota.

Optional live inference experiment, without Gmail delivery:

```powershell
uv run python -X utf8 playground/try_pipeline.py
```

Start the live poller in another terminal:

```powershell
uv run python -m app.poller
```

For development restarts on code or environment-file changes:

```powershell
uv run watchfiles "uv run python -m app.poller" app .env
```

On Windows, the inner `uv run` prevents the watcher’s child command from choosing
a base Python interpreter without the project dependencies.

## Serve the built dashboard

```powershell
cd dashboard
npm ci
npm run build
cd ..
uv run fastapi run app/main.py --host 127.0.0.1 --port 8000
```

Build before starting FastAPI: static-file mounting is determined when the app
is imported. The API and poller are separate processes. For a remote deployment,
use a process supervisor and private network access or properly configured HTTPS.
The [optional VM notes](oracle-free-server-setup.md) include an infrastructure
plan; their container examples require container files that are not bundled in
this checkout.

Run one poller per inbox. Avoid manual `/api/poll` checks while a background
worker is active. PostgreSQL claims reduce duplicate processing, but do not
provide an exactly-once guarantee across email delivery and database writes.

## API reference

All `/api` routes require the configured HTTP Basic credentials. `/health` is
unauthenticated and reports only process availability.

| Method | Route | Behavior |
|---|---|---|
| `GET` | `/health` | Returns `{"status":"ok"}`. Does not check integrations. |
| `GET` | `/api/login` | Validates credentials; returns `{"ok":true}`. |
| `GET` | `/api/events` | Latest 100 events, joined to saved subjects, ticket IDs, and message IDs. |
| `GET` | `/api/tickets` | Latest 100 tickets ordered by update time. |
| `GET` | `/api/tickets/{id}` | One ticket, including older direct links; 404 when absent. |
| `GET` | `/api/tickets/{id}/messages` | Saved inbound/outbound messages in ID order. |
| `GET` | `/api/knowledge-base` | Articles ordered by section and ID. |
| `PUT` | `/api/knowledge-base/{id}` | Updates an existing article with JSON `title` and `content`; 404 when absent. |
| `POST` | `/api/poll` | Runs live processing and returns `{"messages": n}`. Can send email. |

The poll response reports the count of inbox message IDs found by that call. It
does not mean every found message was successfully answered: individual message
failures are recorded and the loop continues. Inspect activity outcomes.

## Statuses, labels, and failures

| Item | Values or meaning |
|---|---|
| Event status | `processing`, `processed`, `skipped`, `failed` |
| Ticket status | `open`, `answered`, `escalated` |
| Final decision | `reply` or `escalate` |
| `ai-processed` | Excludes a handled, skipped, or retry-exhausted message from later inbox queries. |
| `needs-human` | Tells the pipeline a colleague owns the Gmail thread. |

An escalated decision can still produce a `processed` event because the
acknowledgement was sent successfully. Human-handoff summary counts inspect the
decision result, rather than treating every processed event as an automatic
answer. The dashboard’s counts cover the fetched event window.

When a message fails, the event stores the error and can be claimed again on a
later poll. After three failed attempts, the application applies `ai-processed`
to prevent an unbounded retry loop. The failure remains visible for investigation.
It does not automatically send a failure acknowledgement or resolve the ticket.

Human follow-up is performed in Gmail. Removing `needs-human` makes subsequent
messages eligible for automation again; it does not by itself update the stored
ticket status. Review a thread before deciding to re-enable automation.

Known recovery limits: there is no lease expiry for a message stuck in
`processing`, no dead-letter queue, and no atomic transaction joining email sends
to database writes. Investigate those states rather than automatically re-sending
a reply after an uncertain delivery outcome.

## Tests and live evaluations

Offline checks:

```powershell
uv run python -m unittest discover -s tests -v
cd dashboard
npm test
npm run lint
npm run build
```

The Python test imports require valid configuration fields to exist, but the
tests mock integration calls. If no real `.env` is available, provide dummy
nonempty Google credential and database values plus a dummy `GROQ_API_KEY` in
the test environment. Do not start the worker with those values.

Live model evaluations, from the root:

```powershell
uv run python -m evals.run_evals
uv run python -m evals.run_evals --repeat 2
uv run python -m evals.run_evals --suite robustness
uv run python -m evals.run_evals --stage classifier
uv run python -m evals.run_evals --case wrong-finish --verbose
uv run python -m evals.run_evals --output evals/results/review.json
```

The golden suite checks the expected section and action. Robustness cases use
different wording to exercise the same business rules. Classifier-only mode
checks routing and is not a complete-pipeline result.

Cases run sequentially on one event loop; both clients close on that loop.
Request pacing also applies between tool turns. Stop the live poller while
evaluating if both use the same provider quota. JSON diagnostics include model
IDs, cases, assertions, crashes, traces, and the overall result. Failed executions
remain failures; the runner returns a nonzero exit code for any error or mismatch.

These checks do not assess every sentence’s factual accuracy, customer
satisfaction, Gmail delivery reliability, or production throughput. Publish a
model pass rate only alongside its actual run, models, suite, and sample size.

## Troubleshooting

| Symptom | What to check |
|---|---|
| `No module named 'google'` under watchfiles | Use the nested `uv run` command above; check `uv run python -c "import google.auth"`. |
| Gmail timeout or `getaddrinfo failed` | DNS, internet, VPN/proxy, and HTTPS access to `oauth2.googleapis.com` and `gmail.googleapis.com`. |
| Gmail authorization rejected | OAuth client, mailbox authorization, consent-screen status, and refresh token. |
| Dashboard rejects login | Nonempty `DASHBOARD_PASSWORD`, correct username/password, and API restart after configuration changes. |
| Dashboard loads but `/api` fails in development | API is running on port 8000 and the Vite proxy target matches. |
| Model HTTP 429 | Provider reset hint and quotas. Longer/daily exhaustion remains an error after the bounded retry budget. |
| Model schema/tool error | Model capabilities, model-specific settings, structured output, and the recorded stage/error trace. |
| Knowledge sections missing | Migration applied, correct database, seed completed, and DB role permissions. |
| Article edits disappear after seeding | The seed upsert replaced database content from Markdown; avoid re-seeding edited data unintentionally. |
| Old event has no subject/link | It has no matching saved message/ticket, for example an early skip or failure. |
| Changes to built UI do not appear | Rebuild `dashboard/dist`; restart the API if its static mount was absent when it started. |

## Public screenshots

Use [the isolated showcase](VISUALS.md) for public images. It serves the real
frontend build with sample data and blocks writes. It is not an alternate
production API, an authentication implementation, or a live automation service.

Keep `.env`, `credentials.json`, database dumps, unredacted inbox screenshots,
and private evaluation inputs out of public materials. The repository’s ignore
rules exclude the primary credential files; they cannot remove secrets that were
already committed in history.
