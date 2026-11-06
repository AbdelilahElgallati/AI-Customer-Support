# Project presentation kit

Copy-ready descriptions for sharing the project. Add the public repository URL
after publishing it. The descriptions reflect the implemented application; they
do not claim customer deployment, paid engagements, or measured business results.

## GitHub repository description

AI email support workspace with Gmail automation, knowledge-based replies,
Python escalation rules, and a React dashboard. Built with FastAPI, Pydantic AI,
Groq, and PostgreSQL/Supabase.

Suggested repository topics:

`ai-customer-support` · `email-automation` · `fastapi` · `pydantic-ai` · `groq` ·
`react` · `typescript` · `postgresql` · `supabase` · `gmail-api` · `llm-evaluation`

## LinkedIn project entry

**Title:** Harbor & Pine — AI Customer Support Workspace

**Description:**

A full-stack email support application for an e-commerce scenario. It connects
Gmail intake, conversation-aware classification, database-backed knowledge tools,
and Python rules that choose between a reply and a human handoff. The React
workspace makes processing activity, message history, and knowledge editing
accessible to the support team. The project includes typed AI outputs, bounded
request recovery, offline regression tests, and a live model evaluation runner.

**Skills:** Python · FastAPI · React · TypeScript · Pydantic AI · PostgreSQL ·
Gmail API · OAuth 2.0 · LLM evaluation · API integration

## LinkedIn launch post

Customer support automation needs to know when to hand the conversation back
to a person.

I’ve finished Harbor & Pine, an AI email support workspace built around that
decision.

For an e-commerce support scenario, the application:

- Reads new Gmail messages and uses the thread for context.
- Looks up approved product and policy information through knowledge tools.
- Applies Python business rules before deciding what to send.
- Acknowledges sensitive or action-dependent requests and flags them for a colleague.
- Gives the team a dashboard for activity, conversations, and knowledge updates.

One example: a damaged shelving panel. The system can identify the model and
part number, record a suggested replacement step, and hand the request over.
It doesn’t place an order or promise a shipment.

The stack is FastAPI, Pydantic AI, Groq, PostgreSQL/Supabase, React, and TypeScript.
I also worked on the less visible parts: structured outputs, bounded retries,
request pacing, failure records, UI error states, and regression tests.

The screenshots show the actual interface with sample data. The repository
includes the architecture, workflow, setup instructions, and evaluation approach.

I’m interested in opportunities to build practical AI integrations and support
tools for real business workflows. The repository link is below.

#AIEngineering #Python #FastAPI #CustomerSupport #Automation

**Before posting:** attach the images below and paste your published repository
URL. Adjust “I’m interested in opportunities” to match the kind of work you want.

## Shorter LinkedIn version

I’ve finished an AI customer support workspace that connects Gmail, approved
business knowledge, and human handoffs.

The key decision happens in Python: the model classifies and drafts, while
application rules decide whether to send the answer or acknowledge and escalate.

The project also includes a React dashboard, editable knowledge articles,
conversation links, failure tracking, request recovery, and an evaluation runner.

Built with FastAPI, Pydantic AI, Groq, PostgreSQL/Supabase, React, and TypeScript.

Screenshots use sample data. Code and architecture are in the repository linked below.

#AIEngineering #CustomerSupport #FastAPI

## Upwork portfolio entry

**Project title:** AI Email Support Automation & Team Dashboard

**Role:** Full-stack AI application developer

**Short description:**

Built an AI email support workspace connecting Gmail, approved product knowledge,
and human handoffs. It classifies messages, drafts knowledge-based answers, and
uses Python rules to decide whether to reply or escalate. A React dashboard
provides activity tracking, conversation history, exact-message links, and
article editing. Stack: FastAPI, Pydantic AI, Groq, PostgreSQL/Supabase,
React, and TypeScript. Includes offline tests and live evaluation tooling.
Demonstration project; screenshots use sample data.

**Portfolio description:**

Built an email support application for a retail demonstration scenario, connecting
Gmail, an editable knowledge base, and a customer support dashboard.

The system classifies incoming conversations, retrieves relevant product and
policy information, and applies Python rules to choose between a reply and a
human handoff. It preserves message history, processing status, errors, and
suggested next steps. The dashboard lets a team review activity, open the exact
message behind an event, and maintain the knowledge used in future answers.

The implementation includes OAuth integration, typed AI outputs, database
persistence, bounded provider retries, responsive UI states, and regression tests.
It demonstrates a foundation that can be adapted to a client’s policies and
inbox workflow. Business impact would be measured in a client pilot; the demo
does not claim an existing customer rollout.

**Skills and deliverables:**

Python · FastAPI · AI integration · Gmail API · React

**Suggested portfolio image order:**

1. `docs/images/conversations.png` — the customer problem and proposed human step.
2. `docs/images/dashboard-overview.png` — operational visibility.
3. `docs/images/knowledge-base.png` — maintainable business knowledge.
4. `docs/images/architecture.png` — integration and system design.

## Client-facing project summary

**Problem:** Product and policy questions create repeated lookup and triage work,
while exceptions still need a person who can make commitments.

**Solution:** A connected email workflow that uses business knowledge for routine
answers, routes exceptions to a colleague, and records the conversation and its
processing outcome in one support workspace.

**Delivered in this demonstration:** Gmail intake and replies; tool-based
knowledge access; structured classification and drafts; Python decision rules;
ticket and event persistence; a React dashboard; article editing; offline tests;
and a live evaluation runner.

**Potential client adaptation:** Map the client’s real categories and escalation
rules, import approved policies, configure the inbox and model provider, add the
required identity and data controls, and evaluate a representative set of actual
support cases before enabling automatic replies.

**What to measure in a pilot:** Correct routing, human corrections, factual
accuracy, eligible auto-reply rate, time to first response, provider cost per
processed message, and whether handling time changes. None of these is presented
as a measured result for this project.

## Recruiter talking points

- **System integration:** Follow one email across Gmail, Python, model calls,
  database state, and a React view rather than evaluating an isolated chatbot.
- **AI boundaries:** Typed outputs and product rules separate model-extracted
  facts from application decisions. Discuss what still depends on the model.
- **Reliability:** Explain retry budgets, provider reset hints, bounded context
  growth, unique message claims, and the remaining send/write consistency window.
- **Product thinking:** Human follow-up stays visible, the knowledge base is
  editable, and loading/error/empty states are part of the interface.
- **Evaluation:** Distinguish mocked regression tests from live model behavior,
  and topic/action checks from sentence-level answer quality.

## A 60-second walkthrough

**0–10 seconds — Problem.** “Retail support repeats a lot of product and policy
lookup, but some requests need a person to make the decision.”

**10–25 seconds — Activity.** Show the overview and subject-based event table.
Click the leading icon on the damaged-panel example to open the exact message.

**25–40 seconds — Handoff.** Show the original customer message, the
acknowledgement, and `ship-panels` as a proposed action. Explain that the system
has not promised or executed a shipment.

**40–50 seconds — Knowledge.** Open a product article. Explain that future
answers read database-backed knowledge and follow application rules.

**50–60 seconds — Engineering.** Show the architecture image. Mention typed
outputs, failure records, tests, and live evaluations. Point viewers to GitHub.

Use the isolated showcase for recordings. Its data is scripted for presentation;
it does not run inference or deliver email. Demonstrate real integrations
separately when that is the purpose of the recording.

## Image captions and accessible descriptions

| Asset | Suggested caption / alt text |
|---|---|
| Overview | “AI support activity, readable email subjects, and direct conversation links. Demonstration data.” |
| Conversations | “A damaged shelving panel is handed to a colleague with the customer’s message and suggested action visible.” |
| Knowledge base | “Support knowledge organized by section and editable without changing application code.” |
| Architecture | “Gmail, FastAPI, Pydantic AI/Groq, and PostgreSQL connected to the React support workspace.” |
| Workflow | “The processing path from message intake through guards, knowledge lookup, Python decisions, and reply or handoff.” |
| Dark theme | “The same support activity workspace in dark mode, using sample data.” |

## Publishing notes

Replace any platform-specific link placeholder with the actual public URL.
Do not invent a client name, deployment URL, evaluation score, user count, or
percentage saving. If you later run a pilot, replace intended benefits with
measured results and explain the sample and measurement period.

The project is a fictional retail demonstration. Do not describe Harbor & Pine
as a paying client. No license is selected by this documentation; choose one
deliberately if you want to grant reuse rights for the published code.
