"""Read-only deployment checks; never poll, create Gmail labels, or send mail."""

import os

from dotenv import load_dotenv


def main() -> None:
    load_dotenv()
    required = ("GROQ_API_KEY", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET",
                "GOOGLE_REFRESH_TOKEN", "DATABASE_URL")
    missing = [name for name in required if not os.getenv(name)]
    if missing:
        raise SystemExit("Missing variables: " + ", ".join(missing))

    from app import db
    from app.gmail import build_gmail_service

    sections = set(db.list_sections())
    expected = {"brand-and-tone", "escalation-rules", "paddle-boards", "shelving",
                "returns-and-warranty", "shipping"}
    if missing_sections := expected - sections:
        raise SystemExit("Missing KB sections: " + ", ".join(sorted(missing_sections)))
    print("KB sections:", sorted(sections), flush=True)
    service = build_gmail_service()
    service.users().getProfile(userId="me").execute()
    print("Gmail profile accessible", flush=True)
    from app.ai.classifier import classifier
    from app.ai.agent import support_agent

    print("AI agents initialized:", classifier.model.model_name, support_agent.model.model_name)


if __name__ == "__main__":
    main()
