# Fairpay: the Next.js app plus its built-in Cairn agent, in one image.

# ── 1. the agent (Rust, Cairn) ──────────────────────────────────────────
FROM rust:1-slim AS agent
RUN apt-get update && apt-get install -y --no-install-recommends pkg-config libssl-dev git ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /src
COPY agents/cairn-buyer/Cargo.toml agents/cairn-buyer/Cargo.lock ./
COPY agents/cairn-buyer/src ./src
RUN cargo build --release

# ── 2. the web app ──────────────────────────────────────────────────────
FROM node:24-slim AS web
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# ── 3. runtime ──────────────────────────────────────────────────────────
FROM node:24-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production \
    NODE_NO_WARNINGS=1 \
    FAIRPAY_DB=/data/fairpay.db \
    CAIRN_RUNS_DIR=/data/agent-runs \
    FAIRPAY_AGENT_BIN=/app/bin/fairpay-agent
COPY --from=web /app/package.json /app/package-lock.json /app/next.config.ts ./
COPY --from=web /app/node_modules ./node_modules
COPY --from=web /app/.next ./.next
COPY --from=web /app/public ./public
COPY --from=agent /src/target/release/fairpay-agent /app/bin/fairpay-agent
RUN mkdir -p /data
EXPOSE 3000
CMD ["sh", "-c", "npx next start -p ${PORT:-3000}"]
