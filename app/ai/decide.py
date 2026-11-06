from app.ai.agent import write_reply, write_reply_async
from app.ai.classifier import classify, classify_async
from app.ai.rules import CUSTOMER_STEPS, resolve_issue
from app.ai.schemas import AgentReply, Classification, Decision


def _escalate(classification: Classification, reason: str,
              proposed_action: str | None = None) -> Decision:
    return Decision(
        action="escalate",
        section=classification.section,
        reply=classification.acknowledgement,
        reason=reason,
        proposed_action=proposed_action,
    )


def _early_decision(classification: Classification, has_attachments: bool) -> Decision | None:
    if has_attachments:
        return _escalate(classification, "The email has attachments")
    if classification.needs_human:
        return _escalate(classification, classification.reason)
    return None


def _finish_decision(classification: Classification, answer: AgentReply) -> Decision:
    if answer.action == "escalate":
        return _escalate(classification, answer.reasoning)
    if not answer.enough_information:
        return _escalate(classification, "The knowledge base does not answer this")
    if answer.issue:
        step = resolve_issue(answer.issue)
        if step not in CUSTOMER_STEPS:
            return _escalate(classification, f"Next step: {step}", proposed_action=step)
    if answer.promises_an_action:
        return _escalate(classification, "The reply promises an action")

    return Decision(
        action="reply",
        section=classification.section,
        reply=answer.reply,
        reason=answer.reasoning,
    )


def decide(thread: str, has_attachments: bool = False) -> Decision:
    """Synchronous entry point for the inbox poller and playground."""
    classification = classify(thread)
    early = _early_decision(classification, has_attachments)
    if early is not None:
        return early
    return _finish_decision(classification, write_reply(thread, classification.section))


async def decide_async(thread: str, has_attachments: bool = False, *,
                       trace: dict | None = None) -> Decision:
    """Run both agents on the caller's event loop; optionally record eval diagnostics."""
    classification = await classify_async(thread)
    if trace is not None:
        trace["classification"] = classification.model_dump()
    early = _early_decision(classification, has_attachments)
    if early is not None:
        return early
    answer = await write_reply_async(thread, classification.section)
    if trace is not None:
        trace["draft"] = answer.model_dump()
    return _finish_decision(classification, answer)
