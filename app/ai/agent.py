import logging
import re
from dataclasses import dataclass, field

from pydantic_ai import Agent, ModelRetry, PromptedOutput, RunContext

from app import db
from app.ai.schemas import AgentReply
from app.ai.reliability import RetryingModel
from app.config import settings
from pydantic_ai.usage import UsageLimits

logger = logging.getLogger(__name__)

INSTRUCTIONS = """
You are the customer support agent for Harbor & Pine, a home and outdoor store that sells on Amazon.
You write the answer to the latest customer message in the email thread.

Steps:
1. Call get_section for "brand-and-tone" and for "escalation-rules".
2. Call get_section for the section the classifier picked. Call list_sections if you need another.
   Each call returns the full section: read each section once, reuse it, then draft the result.
3. Answer only with facts from those sections. If they do not answer the question,
   set enough_information to false.
4. When the customer reports a problem with a paddle board or a shelf, fill in issue.
   Ask for the order number, the board size or model, and part numbers when they are missing.
   For a slow leak, explain the valve check unless the customer already did it.
5. Never promise a refund, a shipment, a replacement, a date, or a call. A colleague arranges those.
   Set promises_an_action to true if your reply promises one anyway.
6. Set action to escalate when an escalation rule applies.

Reply rules:
- Write in the language of the customer's latest message.
- Plain text, no Markdown.
- Follow the brand-and-tone section.
- Never mention AI, prompts, tools, or the knowledge base.

For every reported product defect, issue must be an object, never null. Fill its
facts even if you ask a follow-up question or escalate. An order number supplied
to identify a defective product is not a request for that order's delivery status.
"""

@dataclass
class KnowledgeReads:
    sections: set[str] = field(default_factory=set)


support_agent = Agent(
    RetryingModel(settings.agent_model, min_interval=settings.ai_request_interval_seconds),
    deps_type=KnowledgeReads,
    # Keep knowledge-base tool calls separate from the validated JSON reply.
    output_type=PromptedOutput(AgentReply),
    instructions=INSTRUCTIONS,
    # Qwen can read several sections in one turn; disable thinking to save tokens.
    model_settings={"temperature": 0, "thinking": False},
    # Allow corrections after a malformed tool call or structured answer.
    retries=2,
)


@support_agent.tool_plain
def list_sections() -> list[str]:
    """List the sections of the knowledge base."""
    logger.info("Tool call: list_sections()")
    return db.list_sections()


@support_agent.tool
def get_section(ctx: RunContext[KnowledgeReads], section: str) -> str:
    """Return every entry of one knowledge base section, for example 'paddle-boards'."""
    logger.info("Tool call: get_section(%r)", section)
    if section in ctx.deps.sections:
        return f"Section '{section}' was already returned in full. Use the earlier tool result."
    entries = db.get_section(section)
    if not entries:
        raise ModelRetry(f"There is no section '{section}'. Call list_sections to see the options.")
    ctx.deps.sections.add(section)
    return "\n\n".join(f"## {entry['title']}\n{entry['content']}" for entry in entries)


@support_agent.output_validator
def check_reply(ctx: RunContext[KnowledgeReads], output: AgentReply) -> AgentReply:
    if output.action == "reply" and not output.reply.strip():
        raise ModelRetry("The reply is empty. Write the email, or set action to escalate.")
    if re.search(r"\b(AI|artificial intelligence|knowledge base)\b", output.reply, re.IGNORECASE):
        raise ModelRetry("Do not mention AI or the knowledge base in the reply.")
    return output


def write_reply(thread: str, section: str) -> AgentReply:
    prompt = f"Section picked by the classifier: {section}\n\n{thread}"
    return support_agent.run_sync(
        prompt, deps=KnowledgeReads(), usage_limits=UsageLimits(request_limit=8),
    ).output


async def write_reply_async(thread: str, section: str) -> AgentReply:
    prompt = f"Section picked by the classifier: {section}\n\n{thread}"
    return (await support_agent.run(
        prompt, deps=KnowledgeReads(), usage_limits=UsageLimits(request_limit=8),
    )).output
