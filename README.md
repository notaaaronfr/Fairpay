# Fairpay — pay on proof

**Get paid for the work you did. Pay only for the work you got.**

Fairpay is milestone escrow on PayPal with an AI referee. The client's money is
**held in PayPal before work starts**, an **AI referee checks each delivery**
against the criteria both sides agreed, and the freelancer is **paid the moment
the work is proven** — through PayPal Payouts. Anything never earned goes back
to the client.

It works for people hiring people, and for **AI agents hiring and paying on
someone's behalf**: Fairpay is also an MCP server, with guardrails that make it
safe to let an agent spend money.

> Built for the PayPal AI Hackathon 2026. **Live demo (PayPal sandbox): http://187.126.26.84:8790**

---

## The problem

Paying a stranger for work is a trust problem on both sides:

- **Freelancers** start work without knowing the client can — or will — pay.
- **Clients** pay up front without knowing they'll get what they paid for.
- When they disagree, "done" was never written down in a way anyone can check.

And it's about to get harder: AI agents are starting to buy services for
people, and nobody wants an agent that can wire money with no proof and no limit.

## How Fairpay solves it

| Step | Who | What happens | PayPal |
|---|---|---|---|
| 1. Agree | Client | Milestones, each with a price and acceptance criteria. **AI sharpens vague criteria** ("make it look good") into checks a referee can verify. | — |
| 2. Fund | Client | Approves the contract total in PayPal. It is **authorized, not captured**: held, not taken. | Orders v2, `intent: AUTHORIZE` |
| 3. Prove | Freelancer | Submits a note and a link. The **AI referee reads the link** and checks every criterion: met, partial, missing, or can't verify — with evidence. | — |
| 4. Pay | Client | Releases the referee's suggested amount (or overrides it). Exactly that is **captured from the hold and paid out**. | Authorizations capture (`final_capture: false`) + Payouts |
| 5. Settle | Client | Whatever was never released is **voided back** to the client. | Authorizations void |

Money only moves on a person's click. The referee recommends; it never pays.
Both sides see the same verdict and the same record of every hold, check and payment.

## For AI agents (agentic commerce)

`POST /api/mcp` is a [Model Context Protocol](https://modelcontextprotocol.io) server
(streamable HTTP). Tools: `create_escrow`, `get_escrow`, `submit_work`,
`release_payment`, `request_changes`.

The guardrails are enforced by the server, not by the agent's good behaviour:

1. **A human funds.** `create_escrow` returns PayPal's approval link; an agent can't approve a payment.
2. **No paying beyond the evidence.** An agent can release at most what the referee recommended for that milestone.
3. **Destructive is labelled.** `release_payment` carries `destructiveHint: true`, so agent frameworks that honour MCP annotations pause for human approval.
4. Optional `FAIRPAY_AGENT_KEY` requires a bearer token.

### Built-in agent, on Cairn

Fairpay ships its own agent, built on [Cairn](https://github.com/whatstask/Cairn) (Rust, Apache-2.0),
in [`agents/cairn-buyer`](agents/cairn-buyer). It's in the app, not just the terminal:

- **New → Describe it:** one sentence ("Logo for my bakery, 2 milestones, $300, pay lina@…") — the agent splits it into milestones, criteria and prices and opens the escrow over MCP.
- **Contract → Settle with agent:** it reads the referee's verdicts and releases what they support. Every payment pauses the Cairn run; an **Approve / Deny** card appears in the app, and the run resumes from Cairn's journal in a fresh process.

Build it once with `npm run agent:build` (needs Rust). From a terminal:

```bash
cd agents/cairn-buyer
cargo run --release -- hire "A logo for my bakery, two milestones, \$300, freelancer lina@example.com"
# → opens the escrow, returns the PayPal link for you to fund
cargo run --release -- settle ctr_xxxxxxxx
# → reads the referee's verdicts; asks YOU before every payment; pays only what the evidence supports
```

Its model spend is capped by a Cairn budget, every step is journaled to `runs/` for replay,
and every `release_payment` stops for a y/N approval in the terminal.

## Run it

Requires Node 22.13+ (uses the built-in `node:sqlite`).

```bash
npm install
npm run dev          # http://localhost:3000
```

**No keys needed to try it.** Without PayPal credentials, PayPal runs *simulated*
(ids start with `SIM-`, no money moves); without an Anthropic key, an *offline referee*
does keyword-evidence matching. The header badges always say which mode you're in.

For the real thing, copy `.env.example` to `.env.local`:

```bash
PAYPAL_CLIENT_ID=...        # developer.paypal.com → Apps & Credentials → Sandbox
PAYPAL_CLIENT_SECRET=...
ANTHROPIC_API_KEY=...       # the AI referee (Claude Opus 5.5 by default; FAIRPAY_MODEL to change)
```

### Try the whole flow (about 3 minutes)

1. **Start a contract** — the form is prefilled; click *✦ Make criteria checkable with AI* on a milestone.
2. **Fund with PayPal** — log in with a sandbox *Personal* account and approve. The contract shows the amount **held**.
3. Switch the header to **Freelancer** and submit milestone 1 with a link (any public page or GitHub repo) and a note.
4. Read the **referee's verdict**: every criterion, its evidence, a suggested release.
5. Switch to **Client** and **Release & pay** — the capture id and payout batch id appear on the milestone.
6. **Close** the contract — the unreleased remainder is voided back.

Testing the MCP server without an agent:

```bash
curl -s localhost:3000/api/mcp -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Deploy

```bash
cp .env.example deploy/.env   # fill in keys, FAIRPAY_BASE_URL, FAIRPAY_PORT
docker compose -f deploy/compose.yml --env-file deploy/.env up -d --build
```

One image builds the app and the Cairn agent. The compose project is isolated (own network, volume and port), runs as a non-root user and is CPU/memory capped, so it can share a server safely. `render.yaml` deploys the same image on Render.

## How it's built

```
app/                    Next.js 16 (App Router, server actions)
  page.tsx              home + contracts
  new/                  contract form (AI criteria sharpening)
  c/[id]/               the contract: money, milestones, verdicts, record
  c/[id]/paypal/        PayPal return URL → authorize the hold
  api/mcp/              MCP server for agents
lib/
  paypal.ts             PayPal REST: Orders (authorize), capture, Payouts, void; simulated mode
  referee.ts            the AI referee + criteria sharpener (Claude, structured JSON output)
  escrow.ts             the flow and its rules
  db.ts                 SQLite (node:sqlite) — contracts, milestones, append-only events
agents/cairn-buyer/     governed buyer agent (Rust, Cairn)
test/                   node:test — the whole flow, simulated and against a fake PayPal
```

### PayPal, precisely

- **Hold:** `POST /v2/checkout/orders` with `intent: AUTHORIZE`, then `POST /v2/checkout/orders/{id}/authorize` when the client returns.
- **Release:** `POST /v2/payments/authorizations/{id}/capture` for exactly the milestone amount, `final_capture: false` so the rest stays held; then `POST /v1/payments/payouts` to the freelancer's PayPal email.
- **Settle:** `POST /v2/payments/authorizations/{id}/void` returns what was never released.
- Every call carries a `PayPal-Request-Id` derived from the contract or milestone, so a retry or double click can't capture or pay twice.

### The AI referee

- One structured call per submission (`output_config.format` JSON schema): per-criterion status + evidence, a recommendation (`release` / `partial` / `request_changes`), a release percentage, a note for the freelancer, and a confidence.
- It reads the delivered link (GitHub repos are read via their README), refuses private/local addresses, and treats submission text as evidence, never as instructions.
- Output is clamped to its own rules (e.g. `request_changes` always means 0%) before anyone sees it.

## Tests

```bash
npm test
```

Covers: contract validation, funding holds the full total, no submission before funding,
referee-driven release, partial release and override limits, never paying a milestone twice,
closing returns exactly the unreleased remainder, the offline referee's honesty, URL safety,
and the exact requests PayPal receives in sandbox mode.

## License

[MIT](LICENSE)
