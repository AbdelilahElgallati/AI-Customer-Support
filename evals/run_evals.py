import argparse
import asyncio
import json
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from pydantic_evals import Case, Dataset
from pydantic_evals.evaluators import Evaluator, EvaluatorContext

from app.ai.agent import support_agent
from app.ai.classifier import classifier, classify_async
from app.ai.decide import decide_async
from app.ai.reliability import exception_chain
from app.ai.schemas import Decision
from app.config import settings
from evals.golden_emails import GOLDEN_EMAILS
from evals.robustness_emails import ROBUSTNESS_EMAILS


@dataclass
class SectionMatches(Evaluator):
    def evaluate(self, ctx: EvaluatorContext) -> bool:
        return ctx.output.section == ctx.expected_output["section"]


@dataclass
class ActionMatches(Evaluator):
    def evaluate(self, ctx: EvaluatorContext) -> bool:
        return ctx.output.action == ctx.expected_output["action"]


traces: list[dict] = []


async def run_pipeline(email: str) -> Decision:
    trace = {"input": email}
    try:
        output = await decide_async(email, trace=trace)
        trace["decision"] = output.model_dump()
        return output
    except Exception as error:
        trace["failed_stage"] = "agent" if "classification" in trace else "classifier"
        trace["error"] = exception_chain(error)
        raise
    finally:
        traces.append(trace)


async def run_classifier(email: str):
    """Diagnose routing without using the drafting model's separate quota."""
    trace = {"input": email}
    try:
        output = await classify_async(email)
        trace["classification"] = output.model_dump()
        return output
    except Exception as error:
        trace.update(failed_stage="classifier", error=exception_chain(error))
        raise
    finally:
        traces.append(trace)


dataset = Dataset(
    name="golden-emails",
    cases=[
        Case(
            name=case["name"],
            inputs=case["email"],
            expected_output={"section": case["section"], "action": case["action"]},
        )
        for case in GOLDEN_EMAILS
    ],
    evaluators=[SectionMatches(), ActionMatches()],
)

def summarize(report) -> dict:
    """Task crashes count against the overall pass rate, alongside wrong answers."""
    passed = sum(bool(case.assertions)
                 and all(assertion.value for assertion in case.assertions.values())
                 and not case.evaluator_failures for case in report.cases)
    total = len(report.cases) + len(report.failures)
    return {"total": total, "completed": len(report.cases), "passed": passed,
            "mismatches": len(report.cases) - passed, "errors": len(report.failures),
            "overall_pass_rate": passed / total if total else 0.0}


async def evaluate(args: argparse.Namespace) -> int:
    traces.clear()
    source = GOLDEN_EMAILS if args.suite == "golden" else ROBUSTNESS_EMAILS
    selected = [Case(name=case["name"], inputs=case["email"],
                     expected_output={"section": case["section"], "action": case["action"]})
                for case in source if not args.case or case["name"] in args.case]
    if not selected:
        raise ValueError("No cases selected; check --case against the selected --suite")
    classifier_only = args.stage == "classifier"
    evaluators = [SectionMatches()] if classifier_only else dataset.evaluators
    selected_dataset = Dataset(name=f"{args.suite}-{args.stage}", cases=selected, evaluators=evaluators)
    # A single event loop owns both async clients. Serial cases fit Groq's free tier
    # better; request-level retries handle token limits that can still occur.
    async with classifier, support_agent:
        report = await selected_dataset.evaluate(run_classifier if classifier_only else run_pipeline,
                                                 max_concurrency=1, repeat=args.repeat)
    report.print(include_input=False, include_output=args.verbose, include_durations=False,
                 include_averages=False)
    summary = summarize(report)
    print("Stage: classifier (section checks only)" if classifier_only else "Stage: complete pipeline")
    print(f"Overall: {summary['passed']}/{summary['total']} cases passed "
          f"({summary['overall_pass_rate']:.1%}); "
          f"{summary['mismatches']} mismatches; {summary['errors']} execution errors.")
    for case in report.cases:
        failed = [name for name, assertion in case.assertions.items() if not assertion.value]
        if failed:
            print(f"Mismatch {case.name}: {', '.join(failed)}; {case.output.reason}")
    payload = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "suite": args.suite,
        "stage": args.stage,
        "models": {"classifier": settings.classifier_model, "agent": settings.agent_model},
        "summary": summary,
        "cases": [{"name": case.name, "expected": case.expected_output,
                   "output": case.output.model_dump(),
                   "assertions": {name: assertion.value for name, assertion in case.assertions.items()}}
                  for case in report.cases],
        "failures": [{"name": failure.name, "error": failure.error_message,
                      "traceback": failure.error_stacktrace} for failure in report.failures],
        "traces": traces,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Diagnostics: {args.output}")
    return int(summary["passed"] != summary["total"])


def main() -> int:
    parser = argparse.ArgumentParser(description="Evaluate all cases against the real AI pipeline.")
    parser.add_argument("--repeat", type=int, default=1, help="Runs per case; failures remain failures.")
    parser.add_argument("--suite", choices=["golden", "robustness"], default="golden")
    parser.add_argument("--stage", choices=["pipeline", "classifier"], default="pipeline",
                        help="Classifier mode checks sections only; default checks the complete pipeline.")
    parser.add_argument("--case", action="append",
                        choices=[case["name"] for case in GOLDEN_EMAILS + ROBUSTNESS_EMAILS])
    parser.add_argument("--verbose", action="store_true", help="Print full replies in the summary table.")
    parser.add_argument("--output", type=Path, default=Path("evals/results/latest.json"))
    args = parser.parse_args()
    if args.repeat < 1:
        parser.error("--repeat must be at least 1")
    logging.basicConfig(level=logging.WARNING, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    return asyncio.run(evaluate(args))


if __name__ == "__main__":
    raise SystemExit(main())
