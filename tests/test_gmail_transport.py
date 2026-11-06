import os
import unittest
from unittest.mock import patch

with patch.dict(os.environ, {
    "GOOGLE_CLIENT_ID": "test", "GOOGLE_CLIENT_SECRET": "test",
    "GOOGLE_REFRESH_TOKEN": "test", "DATABASE_URL": "postgresql://test:test@localhost/test",
}):
    from app.gmail import build_gmail_service
    from app.config import settings


class GmailTransportTests(unittest.TestCase):
    def test_oauth_and_gmail_share_explicit_timeout_without_inbox_operations(self):
        with patch("app.gmail.httplib2.Http") as http, \
                patch("app.gmail.AuthorizedHttp") as authorized, \
                patch("app.gmail.build") as build:
            self.assertIs(build_gmail_service(), build.return_value)
        http.assert_called_once_with(timeout=settings.gmail_timeout_seconds)
        self.assertIs(authorized.call_args.kwargs["http"], http.return_value)
        build.assert_called_once_with("gmail", "v1", http=authorized.return_value,
                                      cache_discovery=False)
        build.return_value.users.assert_not_called()
