# Devpost submission — Fairpay

## Project details

### About the project

## Inspiration
Paying a stranger for work is a trust problem on both sides. Freelancers start work without knowing the client will pay; clients pay without knowing they'll get what they paid for. And when they disagree, "done" was never written down in a way anyone could check. Now AI agents are starting to buy services for people — and nobody wants an agent that can send money with no proof and no limit.

## What it does
**Fairpay is pay-on-proof escrow on PayPal, with an AI referee.**

1. **Agree** — milestones, each with a price and acceptance criteria. AI turns vague criteria ("make it look good") into checks anyone can verify.
2. **Fund** — the client approves the total in PayPal. It's *authorized, not captured*: held, not taken. The freelancer can see the money exists before starting.
3. **Prove** — the freelancer submits a link and a note. The **AI referee** reads the link and checks every criterion — met, partial, missing or can't-verify — with the evidence, then recommends how much to release.
4. **Pay** — the client releases with one click: exactly that amount is captured from the hold and paid to the freelancer through **PayPal Payouts**. Whatever is never earned is voided back.

**Agents can hire too.** Fairpay is an MCP server, and it ships a built-in agent on **Cairn**: describe a job in one sentence and it drafts the milestones, criteria and prices and opens the escrow; ask it to settle and it pays what the referee supports — pausing for a human's **Approve / Deny** before every payment.

In our sandbox run, the referee looked at a logo-concepts delivery, confirmed three bakery-themed concepts, noticed it couldn't open the six image files, and recommended **50%** — with a note telling the freelancer exactly what would unlock the rest. $60 was captured from the hold and paid out; $240 stayed held.

## How we built it
- **PayPal (sandbox):** Orders v2 with `intent: AUTHORIZE` to hold the budget; Authorizations `capture` with `final_capture: false` to take exactly one milestone's amount; **Payouts** to pay the freelancer; Authorizations `void` to return the rest. Every call carries a `PayPal-Request-Id`, so a retry or double click can never capture or pay twice.
- **AI referee:** Claude Opus 5.5 with structured JSON output — per-criterion status and evidence, recommendation, release percentage, confidence. Output is clamped to its own rules before anyone sees it; link fetching refuses private/local addresses; submission text is treated as evidence, never instructions.
- **Agents:** an MCP server (`/api/mcp`) with five tools, and a Cairn (Rust) agent built into the app. Guardrails are enforced by the server, not the agent: a human always funds; an agent can never release more than the referee recommended; `release_payment` is marked destructive so Cairn pauses the run for approval and resumes it from its journal.
- **App:** Next.js 16, React 19, SQLite (Node's built-in `node:sqlite`), Motion for animation. Runs with **zero keys** (simulated PayPal + offline referee) so anyone can try it.
- **Tests:** 16 tests cover the escrow rules, the exact requests PayPal receives, and the agent guardrails.

## Challenges we ran into
- Making money movement idempotent end to end — a double click must not pay twice, at our layer or PayPal's.
- Letting an AI judge work without letting it move money. The answer was separating *recommend* from *release*, and enforcing caps on the server.
- Pausing an agent mid-run for a human, across HTTP requests: Cairn's event journal lets a run resume in a brand-new process after the approval.

## Accomplishments that we're proud of
- A full real sandbox run: hold → AI verdict → partial capture → Payout, with the remainder still held.
- A referee that says "I can't verify this" instead of guessing — fair to both sides.
- An agent that can spend money safely, because the rules live in the server.

## What we learned
Authorization-then-partial-capture is the right primitive for milestone escrow; AI is most useful here as an evidence-checker, not a decision-maker; and agent safety is a server-side property.

## What's next for Fairpay
Disputes with a second opinion, multi-currency, rendering images/PDFs for the referee, and Venmo/PayPal wallet payouts for freelancers.

### Built with
nextjs, react, typescript, node.js, sqlite, paypal-orders-api, paypal-payouts-api, paypal-sandbox, claude, anthropic-api, model-context-protocol, cairn, rust, motion, docker

### "Try it out" links
- https://github.com/notaaaronfr/Fairpay
- (hosted demo URL — added once deployed)

### Image gallery
`docs/thumbnail.png` plus screenshots of: home, contract with verdict, new escrow, activity.

---

## Additional info (for judges)

| Field | Answer |
|---|---|
| Submitter type | Individual |
| Country of residence | United Arab Emirates |
| Canada province | N/A |
| Organization name | N/A |
| New or existing? | New — created during the submission period |
| If it existed before | N/A |
| Sponsor tools used | None (Render config included in the repo; optional) |
| Code repository | https://github.com/notaaaronfr/Fairpay |
| Working demo | (hosted URL) |

**How the project meets the technology requirement**

PayPal (sandbox): Orders v2 `intent: AUTHORIZE` holds the client's budget; `POST /v2/payments/authorizations/{id}/capture` with `final_capture: false` captures exactly the released milestone amount; `POST /v1/payments/payouts` pays the freelancer; `POST /v2/payments/authorizations/{id}/void` returns unreleased funds. AI: Claude Opus 5.5 (Anthropic API, structured outputs) is the referee that checks each submission against its acceptance criteria and recommends the release amount, and it sharpens vague criteria into checkable ones. Agents: an MCP server plus a built-in Cairn (Rust) agent that drafts and settles escrows under server-enforced caps and human approval.

**Testing instructions**

No keys needed to try locally: `npm install && npm run dev` — PayPal runs simulated and the referee runs offline; the header shows the mode. On the hosted demo (PayPal sandbox): open New → use the prefilled form or "Describe it" → Fund with PayPal and approve with any PayPal **sandbox Personal** account → switch the header avatar to FR (freelancer) → submit a milestone with a public link → switch back to CL (client) → Release. MCP: `curl -s <demo>/api/mcp -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`.

**Overall experience rating:** 8 / 10 — Authorize-then-partial-capture fits milestone escrow perfectly and the sandbox is quick to set up. Friction: the sandbox checkout follows the account's region (ours rendered in Arabic), Payouts must be enabled per app, and it took some digging to confirm partial captures plus a final void are supported on one authorization.

**AI tools leveraged:** Claude Code (Claude Opus 5.5) for building; Claude Opus 5.5 via the Anthropic API as the in-app referee and criteria sharpener; Cairn (Rust agent framework) for the built-in agent.

**For you to choose yourself:** the three eligibility checkboxes, "open to contact", level of learning, and AI value.
