"""Serve the built dashboard with isolated sample data for portfolio screenshots.

Run from the repository root: python scripts/showcase_server.py
This server binds only to localhost, never imports app/config, never reads .env,
and never connects to Gmail, Groq, or a database. Stop it with Ctrl+C.
"""

import argparse
import json
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dashboard" / "dist"
STAMP = "2026-11-06T10:"


def ticket(identifier, subject, customer, category, status, action, minute):
    return {"id": identifier, "subject": subject, "customer_email": customer,
            "category": category, "status": status, "proposed_action": action,
            "updated_at": f"{STAMP}{minute}:00Z"}


TICKETS = [
    ticket(108, "A damaged panel on my HP-S3 bookcase", "alex.morgan@example.com", "shelving", "escalated", "ship-panels", "48"),
    ticket(107, "Choosing a paddle board for summer", "jamie.chen@example.com", "paddle-boards", "answered", None, "42"),
    ticket(106, "How do I adjust the cam locks?", "sam.rivera@example.com", "shelving", "answered", None, "35"),
    ticket(105, "Can I return my unopened shelf?", "riley.james@example.com", "returns-and-warranty", "answered", None, "28"),
    ticket(104, "Help with my delivery status", "taylor.reed@example.com", "shipping", "escalated", None, "20"),
    ticket(103, "Where can replacement parts be delivered?", "casey.lee@example.com", "shipping", "answered", None, "12"),
    ticket(102, "A slow leak after the first outing", "jordan.bell@example.com", "paddle-boards", "answered", None, "05"),
]

MESSAGES = {
    108: [
        {"id": 301, "direction": "in", "from_address": "alex.morgan@example.com",
         "body": "Hi Harbor & Pine,\n\nMy HP-S3 bookcase arrived yesterday, but shelf panel 4 has a crack along the edge. The sticker says HP-S3-04.\n\nMy order number is DEMO-108. The rest of the bookcase looks fine. Could you help me with the next step?\n\nThanks,\nAlex", "created_at": f"{STAMP}46:00Z"},
        {"id": 302, "direction": "out", "from_address": "support@harborandpine.example",
         "body": "Hi Alex,\n\nThank you for letting us know about the damaged panel. I’m sorry it arrived in that condition.\n\nI’ve noted the model, part number, and order reference. A colleague will review your message and reply within one business day to help with the next step.\n\nHarbor & Pine support", "created_at": f"{STAMP}48:00Z"},
    ],
    107: [
        {"id": 303, "direction": "in", "from_address": "jamie.chen@example.com", "body": "Hello, I’m comparing your paddle boards for summer. Where should I start when choosing a size?", "created_at": f"{STAMP}40:00Z"},
        {"id": 304, "direction": "out", "from_address": "support@harborandpine.example", "body": "Hi Jamie,\n\nWhat is your weight, and will you usually paddle alone or with extra gear? Those details will help us point you toward the right board size.\n\nHarbor & Pine support", "created_at": f"{STAMP}42:00Z"},
    ],
    106: [
        {"id": 305, "direction": "in", "from_address": "sam.rivera@example.com", "body": "Hi, I’m putting together my HP-S5. Which way should the cam-lock arrows face?", "created_at": f"{STAMP}33:00Z"},
        {"id": 306, "direction": "out", "from_address": "support@harborandpine.example", "body": "Hi Sam,\n\nThe arrow on each cam lock should point toward the hole for the cam bolt. Once the bolt is seated, turn the cam lock clockwise until it stops, about half a turn.\n\nHarbor & Pine support", "created_at": f"{STAMP}35:00Z"},
    ],
}
EXTRA_EXAMPLES = {
    105: ("Hi, how do I begin a return for an unopened shelf?", "Please start with the return instructions on the platform where you placed the order. If you need help with a specific request, a colleague can review the details."),
    104: ("My order has not arrived. Can you check its delivery status?", "Thank you for reaching out. A colleague will review your delivery question and reply within one business day."),
    103: ("Can replacement parts be delivered to a different address?", "Replacement parts ship to the same address as the original order."),
    102: ("My board seems to lose a little air. I have not checked the valve yet. What should I do first?", "Please check the valve first. Could you also share the board size and how long it has been since delivery so we can help with the next step?"),
}
for item in TICKETS:
    if item["id"] in MESSAGES:
        continue
    position = next(index for index, ticket in enumerate(TICKETS) if ticket["id"] == item["id"])
    incoming, outgoing = EXTRA_EXAMPLES[item["id"]]
    MESSAGES[item["id"]] = [
        {"id": 301 + position * 2, "direction": "in", "from_address": item["customer_email"], "body": incoming, "created_at": item["updated_at"]},
        {"id": 302 + position * 2, "direction": "out", "from_address": "support@harborandpine.example", "body": outgoing + "\n\nHarbor & Pine support", "created_at": item["updated_at"]},
    ]
EVENTS = []
for index, item in enumerate(TICKETS):
    EVENTS.append({"id": 208 - index, "gmail_message_id": f"demo-message-{108 - index}",
                   "status": "processed", "attempts": 1, "error": None,
                   "created_at": item["updated_at"], "subject": item["subject"],
                   "ticket_id": item["id"], "message_id": 301 + index * 2,
                   "result": {"action": "escalate" if item["status"] == "escalated" else "reply"}})
EVENTS.extend([
    {"id": 201, "gmail_message_id": "demo-bulk-mail", "status": "skipped", "attempts": 1,
     "error": None, "created_at": "2026-11-06T09:58:00Z", "subject": None, "ticket_id": None, "message_id": None,
     "result": {"reason": "bulk or list mail"}},
])


def knowledge_entries():
    entries = []
    for path in sorted((ROOT / "knowledge_base").glob("*.md")):
        for block in path.read_text(encoding="utf-8").split("\n## ")[1:]:
            title, _, content = block.partition("\n")
            entries.append({"id": len(entries) + 1, "section": path.stem, "title": title.strip(), "content": content.strip()})
    return entries


class ShowcaseHandler(SimpleHTTPRequestHandler):
    def send_json(self, value, status=200):
        body = json.dumps(value).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == "/api/events":
            return self.send_json(EVENTS)
        if path == "/api/tickets":
            return self.send_json(TICKETS)
        if path == "/api/knowledge-base":
            return self.send_json(knowledge_entries())
        if path == "/api/login":
            return self.send_json({"ok": True, "showcase": True})
        if path.startswith("/api/tickets/"):
            parts = path.strip("/").split("/")
            try:
                identifier = int(parts[2])
            except (ValueError, IndexError):
                return self.send_json({"detail": "Invalid showcase ticket"}, 404)
            if len(parts) == 4 and parts[3] == "messages":
                return self.send_json(MESSAGES.get(identifier, []))
            item = next((item for item in TICKETS if item["id"] == identifier), None)
            return self.send_json(item or {"detail": "Not found"}, 200 if item else 404)
        if path.startswith("/api/"):
            return self.send_json({"detail": "Not available in the showcase"}, 404)
        if path in ("/", "/index.html"):
            html = (DIST / "index.html").read_text(encoding="utf-8")
            # This demo-only origin contains no real credentials. Production files are unchanged.
            bootstrap = '<script>if(new URLSearchParams(location.search).has("signed-out")){sessionStorage.removeItem("dashboard-login")}else{sessionStorage.setItem("dashboard-login",btoa("demo:demo"))}</script>'
            body = html.replace("<head>", "<head>" + bootstrap, 1).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        return super().do_GET()

    def do_POST(self):
        self.send_json({"detail": "Read-only showcase. No email is sent."}, 405)

    def do_PUT(self):
        self.send_json({"detail": "Read-only showcase. No article is changed."}, 405)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=4178)
    args = parser.parse_args()
    if not (DIST / "index.html").is_file():
        raise SystemExit("Build the dashboard first: cd dashboard && npm run build")
    server = ThreadingHTTPServer(("127.0.0.1", args.port), partial(ShowcaseHandler, directory=str(DIST)))
    print(f"Sample-data showcase: http://localhost:{args.port}/", flush=True)
    print("Read-only. No Gmail, AI provider, or database connections. Ctrl+C to stop.", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
