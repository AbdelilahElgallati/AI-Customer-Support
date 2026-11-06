import asyncio
import os
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from pydantic_ai.exceptions import ModelConnectionError, ModelHTTPError, ModelQuotaExceededError, ModelRetry
from pydantic_ai.messages import ModelResponse, TextPart
from pydantic_ai.models import ModelRequestParameters
from pydantic_ai.models.test import TestModel
from pydantic_evals import Case, Dataset

# Imports construct settings and clients; offline tests never need real credentials.
with patch.dict(os.environ, {
    "GOOGLE_CLIENT_ID": "test", "GOOGLE_CLIENT_SECRET": "test",
    "GOOGLE_REFRESH_TOKEN": "test", "DATABASE_URL": "postgresql://test:test@localhost/test",
    "GROQ_API_KEY": "test",
}):
    from app.ai.agent import KnowledgeReads, get_section
    from app.ai.classifier import check_classification
    from app.ai.decide import decide_async
    from app.ai.reliability import RetryingModel, exception_chain, retry_delay
    from app.ai.schemas import AgentReply, Classification, Decision, Issue
    from evals.run_evals import ActionMatches, SectionMatches, summarize


class RetryTests(unittest.IsolatedAsyncioTestCase):
    async def request(self, outcomes, **limits):
        underlying = TestModel()
        underlying.request = AsyncMock(side_effect=outcomes)
        wrapper = RetryingModel(underlying, **limits)
        self.underlying = underlying
        self.response = ModelResponse(parts=[TextPart("ok")])
        with patch("app.ai.reliability.asyncio.sleep", new_callable=AsyncMock) as sleep:
            with patch("app.ai.reliability.random.uniform", return_value=0.1):
                self.sleep = sleep
                return await wrapper.request([], None, ModelRequestParameters())

    async def test_429_respects_retry_after_and_has_one_retry_owner(self):
        response = ModelResponse(parts=[TextPart("ok")])
        error = ModelHTTPError(429, "test", headers={"retry-after": "4"})
        self.assertIs(await self.request([error, response]), response)
        self.sleep.assert_awaited_once_with(4.1)
        self.assertEqual(self.underlying.request.await_count, 2)
        calls = self.underlying.request.await_args_list
        self.assertIs(calls[0].args[0], calls[1].args[0])
        self.assertEqual(calls[0].args[1]["max_retries"], 0)

    async def test_connection_error_recovers_at_request_boundary(self):
        response = ModelResponse(parts=[TextPart("ok")])
        self.assertIs(await self.request([ModelConnectionError("test", "reset"), response]), response)
        self.assertEqual(self.underlying.request.await_count, 2)

    async def test_permanent_failures_are_not_retried(self):
        for status in (400, 401, 403, 413):
            with self.subTest(status=status):
                with self.assertRaises(ModelHTTPError):
                    await self.request([ModelHTTPError(status, "test")])
                self.sleep.assert_not_awaited()
                self.assertEqual(self.underlying.request.await_count, 1)

    async def test_retry_attempts_are_bounded(self):
        error = ModelConnectionError("test", "reset")
        with self.assertRaises(ModelConnectionError):
            await self.request([error] * 3, max_attempts=3)
        self.assertEqual(self.underlying.request.await_count, 3)
        self.assertEqual(self.sleep.await_count, 2)

    async def test_long_provider_reset_is_not_retried_early(self):
        with self.assertRaises(ModelHTTPError):
            await self.request([ModelHTTPError(429, "test", retry_after=3600)])
        self.sleep.assert_not_awaited()

    async def test_retry_budget_stops_without_sleeping_past_deadline(self):
        with self.assertRaises(ModelHTTPError):
            await self.request([ModelHTTPError(429, "test", retry_after=10)], retry_budget=5)
        self.sleep.assert_not_awaited()

    async def test_coding_errors_and_cancellation_are_not_retried(self):
        for error in (RuntimeError("invalid state"), asyncio.CancelledError()):
            with self.subTest(error=type(error).__name__):
                with self.assertRaises(type(error)):
                    await self.request([error])
                self.sleep.assert_not_awaited()

    def test_reset_time_from_groq_body(self):
        error = ModelHTTPError(429, "test", body={"error": {"message": "Please try again in 16.98s."}})
        self.assertEqual(retry_delay(error, 1), 16.98)
        daily = ModelHTTPError(429, "test", body={"error": {"message": "Please try again in 7m28.416s."}})
        self.assertAlmostEqual(retry_delay(daily, 1), 448.416)
        self.assertIsNone(retry_delay(ModelQuotaExceededError("test", "quota exhausted"), 1))

    def test_nested_connection_cause_remains_visible(self):
        error = ModelConnectionError("test", "Connection error.")
        error.__cause__ = RuntimeError("Event is bound to a different event loop")
        self.assertIn("different event loop", exception_chain(error))

    def test_rate_limit_diagnostics_include_provider_explanation(self):
        error = ModelHTTPError(429, "test", body={"error": {
            "message": "Rate limit reached on tokens per day. Please try again in 7m28s."}})
        self.assertIn("tokens per day", exception_chain(error))

    async def test_pacing_applies_between_requests_including_tool_turns(self):
        underlying = TestModel()
        underlying.request = AsyncMock(return_value=ModelResponse(parts=[TextPart("ok")]))
        wrapper = RetryingModel(underlying, min_interval=30)
        with patch("app.ai.reliability.time") as clock:
            clock.monotonic.return_value = 100
            with patch("app.ai.reliability.asyncio.sleep", new_callable=AsyncMock) as sleep:
                await wrapper.request([], None, ModelRequestParameters())
                sleep.assert_not_awaited()
                await wrapper.request([], None, ModelRequestParameters())
                sleep.assert_awaited_once_with(30)
        self.assertEqual(underlying.request.await_count, 2)

    async def test_pacing_resumes_after_a_slow_retry(self):
        underlying = TestModel()
        underlying.request = AsyncMock(side_effect=[ModelHTTPError(429, "test", retry_after=4),
            ModelResponse(parts=[TextPart("ok")]), ModelResponse(parts=[TextPart("ok")])])
        wrapper = RetryingModel(underlying, min_interval=30)
        with patch("app.ai.reliability.time") as clock:
            clock.monotonic.side_effect = [100, 100, 100, 150, 150, 150, 180]
            with patch("app.ai.reliability.random.uniform", return_value=0.1):
                with patch("app.ai.reliability.asyncio.sleep", new_callable=AsyncMock) as sleep:
                    await wrapper.request([], None, ModelRequestParameters())
                    await wrapper.request([], None, ModelRequestParameters())
        self.assertEqual([call.args[0] for call in sleep.await_args_list], [4.1, 30])


class PipelineTests(unittest.IsolatedAsyncioTestCase):
    def classification(self):
        return Classification(section="paddle-boards", language="English", needs_human=False,
                              reason="Product question", acknowledgement="A colleague will reply.")

    def test_unsupported_topic_cannot_be_marked_for_automatic_answering(self):
        classification = self.classification().model_copy(update={"section": "other"})
        with self.assertRaises(ModelRetry):
            check_classification(classification)
        classification.needs_human = True
        self.assertIs(check_classification(classification), classification)

    async def test_async_evaluation_stays_on_one_loop(self):
        loops = []

        async def classify(_):
            loops.append(asyncio.get_running_loop())
            return self.classification()

        async def draft(*_):
            loops.append(asyncio.get_running_loop())
            return AgentReply(action="reply", reply="Check the valve.", reasoning="Instructions",
                              enough_information=True, promises_an_action=False)

        with patch("app.ai.decide.classify_async", side_effect=classify):
            with patch("app.ai.decide.write_reply_async", side_effect=draft):
                with patch("app.ai.decide.classify", side_effect=AssertionError("Sync API used")):
                    outputs = await asyncio.gather(*(decide_async("question") for _ in range(4)))
        self.assertEqual(len(loops), 8)
        self.assertTrue(all(loop is asyncio.get_running_loop() for loop in loops))
        self.assertTrue(all(output.action == "reply" for output in outputs))

    async def test_rules_use_extracted_facts_without_model_reruns(self):
        cases = [
            (Issue(product="paddle-board", problem="missing-accessory"), "reply", None),
            (Issue(product="paddle-board", problem="missing-accessory", order_number="test"),
             "escalate", "ship-part"),
            (Issue(product="paddle-board", problem="slow-leak", valve_checked=False), "reply", None),
            (Issue(product="paddle-board", problem="slow-leak", valve_checked=True,
                   days_since_delivery=12, order_number="test"), "escalate", "new-board"),
        ]
        for issue, action, proposed in cases:
            with self.subTest(issue=issue):
                draft = AgentReply(action="reply", reply="Helpful reply", reasoning="Policy",
                                   enough_information=True, promises_an_action=False, issue=issue)
                trace = {}
                with patch("app.ai.decide.classify_async", return_value=self.classification()):
                    with patch("app.ai.decide.write_reply_async", return_value=draft) as write:
                        result = await decide_async("a customer message", trace=trace)
                self.assertEqual((result.action, result.proposed_action), (action, proposed))
                write.assert_awaited_once()
                self.assertEqual(trace["draft"]["issue"], issue.model_dump())

    def test_repeated_knowledge_reads_do_not_duplicate_content_or_leak_between_runs(self):
        first = SimpleNamespace(deps=KnowledgeReads())
        second = SimpleNamespace(deps=KnowledgeReads())
        entries = [{"title": "Example", "content": "Complete section"}]
        with patch("app.ai.agent.db.get_section", return_value=entries) as read:
            self.assertIn("Complete section", get_section(first, "shipping"))
            self.assertIn("already returned", get_section(first, "shipping"))
            self.assertIn("Complete section", get_section(second, "shipping"))
        self.assertEqual(read.call_count, 2)

    async def test_overall_score_includes_crashes_and_wrong_answers(self):
        expected = {"section": "shipping", "action": "reply"}
        dataset = Dataset(name="score-test", cases=[
            Case(name=name, inputs=name, expected_output=expected)
            for name in ("pass", "wrong", "crash")
        ], evaluators=[ActionMatches(), SectionMatches()])

        async def task(name):
            if name == "crash":
                raise ModelConnectionError("test", "Connection error.")
            return Decision(action="escalate" if name == "wrong" else "reply",
                            section="shipping", reply="Example", reason="Example")

        report = await dataset.evaluate(task, max_concurrency=1, progress=False)
        summary = summarize(report)
        self.assertEqual(summary["passed"], 1)
        self.assertEqual(summary["mismatches"], 1)
        self.assertEqual(summary["errors"], 1)
        self.assertEqual(summary["overall_pass_rate"], 1 / 3)


if __name__ == "__main__":
    unittest.main()
