# Screenshots and architecture assets

The public images document the actual frontend and the implemented system.
Screen contents use synthetic customer names, reserved example-domain addresses,
and manually prepared conversations. They are presentation fixtures, not a record
of model output or customer performance. The knowledge editor shows bundled
project articles.

## Asset inventory

| File | Use |
|---|---|
| [dashboard-overview.png](images/dashboard-overview.png) | README product overview and general portfolio preview. |
| [conversations.png](images/conversations.png) | Customer message, acknowledgement, and suggested human action. |
| [knowledge-base.png](images/knowledge-base.png) | Library navigation and article editing. |
| [sign-in.png](images/sign-in.png) | Brand presentation and workspace access screen. |
| [dashboard-dark.png](images/dashboard-dark.png) | Alternate theme. |
| [architecture.png](images/architecture.png) | High-resolution system overview for posts and portfolio uploads. |
| [workflow.png](images/workflow.png) | Complete message-processing decision flow. |
| [data-model.png](images/data-model.png) | Tables, key fields, and relationships. |

Scalable diagram exports and their editable Mermaid sources live in
[`diagrams/`](diagrams/). SVGs are useful when zooming into labels; PNGs are
convenient for platforms that do not accept vector graphics.

## Reproduce the screenshot environment

Build the real dashboard from the repository root:

```powershell
cd dashboard
npm ci
npm run build
cd ..
python scripts/showcase_server.py
```

Open `http://localhost:4178/`. The local server:

- Binds to loopback only.
- Serves `dashboard/dist` without modifying it.
- Supplies isolated sample API responses.
- Loads the bundled knowledge Markdown, not your database.
- Never imports the application configuration or reads `.env`.
- Blocks inbox checks and article writes.
- Initializes a dummy login only on this separate demo origin.

Useful views:

| URL | View |
|---|---|
| `http://localhost:4178/#events` | Activity overview. |
| `http://localhost:4178/#tickets?ticket=108` | Damaged-panel example, including the acknowledgement. |
| `http://localhost:4178/#tickets?ticket=108&message=301` | Exact-message highlight used by activity links. |
| `http://localhost:4178/#knowledge-base` | Knowledge library; select an article to display its editor. |
| `http://localhost:4178/?signed-out=1` | Sign-in screen. |

Capture a normal browser view or use a full-page screenshot tool. For an overview
image, a full-page capture includes the event table below the summary cards. Avoid
showing browser extensions, unrelated tabs, or real inbox information. Keep the
original files if preparing platform-specific crops.

The current desktop captures use the existing browser’s full-page capture
extension. No application UI was reconstructed or generated as an illustration.
For screenshots of the real integration path, inspect and redact private data
before adding images to the repository.

Stop the showcase with Ctrl+C. It is a local presentation helper, not a deployable
replacement for the authenticated production API.

## Regenerate diagrams

Install Mermaid CLI separately if it is not already available:

```powershell
npm install --global @mermaid-js/mermaid-cli
```

From the project root:

```powershell
mmdc -i docs/diagrams/architecture.mmd -o docs/diagrams/architecture.svg -c docs/diagrams/mermaid-config.json -b white -w 1800
mmdc -i docs/diagrams/architecture.mmd -o docs/images/architecture.png -c docs/diagrams/mermaid-config.json -b white -w 1800 -s 2
mmdc -i docs/diagrams/workflow.mmd -o docs/diagrams/workflow.svg -c docs/diagrams/mermaid-config.json -b white -w 1600
mmdc -i docs/diagrams/workflow.mmd -o docs/images/workflow.png -c docs/diagrams/mermaid-config.json -b white -w 1600 -s 2
mmdc -i docs/diagrams/data-model.mmd -o docs/diagrams/data-model.svg -c docs/diagrams/mermaid-config.json -b white -w 1800
mmdc -i docs/diagrams/data-model.mmd -o docs/images/data-model.png -c docs/diagrams/mermaid-config.json -b white -w 1800 -s 2
```

Mermaid CLI requires a compatible browser. If its managed browser is unavailable,
provide a local Puppeteer configuration containing `executablePath`, then add
`-p path/to/your-local-config.json`. Do not commit machine-specific browser paths.

## Suggested LinkedIn image sequence

Lead with the conversation view for a problem-and-solution story, or the overview
for a product announcement. Follow with the architecture, the knowledge editor,
and the decision workflow. The complete workflow is dense; share it as a
supporting image that readers can enlarge rather than squeezing it into a small
thumbnail. Keep “sample data” in the accompanying description.
