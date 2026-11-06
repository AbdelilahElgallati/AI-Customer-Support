"""Offline checks for activity subjects and conversation links."""
import sqlite3
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app import db
from app.main import app, settings


class QueryConnection:
    """Run the portable SELECT queries against a real, isolated SQL database."""
    def __init__(self):
        self.connection = sqlite3.connect(":memory:")
        self.connection.row_factory = sqlite3.Row

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def execute(self, query, params=()):
        return self.connection.execute(query.replace("%s", "?"), params)


class ActivityQueryTests(unittest.TestCase):
    def setUp(self):
        self.db = QueryConnection()
        self.db.connection.executescript("""
            create table events (id integer primary key, gmail_message_id text unique, status text);
            create table tickets (id integer primary key, subject text);
            create table messages (id integer primary key, gmail_message_id text unique, ticket_id integer);
            insert into tickets values (10, 'A damaged bookcase');
            insert into messages values (21, 'gmail-a', 10), (22, 'gmail-b', 10);
            insert into events values (1, 'gmail-a', 'processed'), (2, 'gmail-b', 'failed'), (3, 'gmail-skipped', 'skipped');
        """)
        self.addCleanup(self.db.connection.close)

    def test_events_include_subject_and_exact_message_without_dropping_skipped_events(self):
        with patch.object(db, "connect", return_value=self.db):
            rows = [dict(row) for row in db.list_events()]
        self.assertEqual([row["id"] for row in rows], [3, 2, 1])
        self.assertIsNone(rows[0]["ticket_id"])
        self.assertIsNone(rows[0]["subject"])
        self.assertEqual(rows[1]["subject"], "A damaged bookcase")
        self.assertEqual(rows[1]["ticket_id"], 10)
        self.assertEqual(rows[1]["message_id"], 22)
        self.assertEqual(rows[2]["message_id"], 21)

    def test_event_limit_and_direct_ticket_lookup(self):
        with patch.object(db, "connect", return_value=self.db):
            self.assertEqual(len(db.list_events(limit=1)), 1)
            self.assertEqual(dict(db.get_ticket(10)), {"id": 10, "subject": "A damaged bookcase"})
            self.assertIsNone(db.get_ticket(99))


class TicketDetailTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.addCleanup(self.client.close)

    def test_ticket_detail_keeps_authentication_required(self):
        with patch.object(db, "get_ticket") as get_ticket:
            self.assertEqual(self.client.get("/api/tickets/10").status_code, 401)
            get_ticket.assert_not_called()

    def test_authenticated_lookup_and_missing_ticket(self):
        with patch.object(settings, "dashboard_username", "test"), patch.object(settings, "dashboard_password", "test-only"):
            with patch.object(db, "get_ticket", return_value={"id": 10, "subject": "A damaged bookcase"}):
                response = self.client.get("/api/tickets/10", auth=("test", "test-only"))
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json()["subject"], "A damaged bookcase")
            with patch.object(db, "get_ticket", return_value=None):
                response = self.client.get("/api/tickets/99", auth=("test", "test-only"))
                self.assertEqual(response.status_code, 404)


if __name__ == "__main__":
    unittest.main()
