# Stellar Trading Agent

> An AI agent that investigates before you trade.

Built for the **AI x Stellar** hackathon track.

Stellar Trading Agent is a read-only AI agent for traders on the Stellar network. Paste an address and it learns how that account trades. Ask about a swap and it checks the asset, reads the order book, and returns a verdict with the evidence behind it. It never holds keys, signs anything, or moves funds.

## What it does

- **Learns how you trade.** Reads an account's trade history from Horizon and gives short coaching insights, each tied to the stat behind it (most-traded pair, average order size, buy/sell ratio).
- **Checks swaps before you make them.** Ask "Is it safe to swap 500 XLM to USDC?" and the agent verifies the asset's issuer, estimates slippage from live order book depth, and answers with `go`, `careful` or `avoid` plus reasons.
- **Adapts to you.** Thumbs up or down on each answer is saved as a preference profile and sent with the next request, so the agent's focus and tone shift over time.
- **Shows its work.** A live agent trace lists every tool call as it happens.

## How it works

1. You send a message in the chat (an address, or a swap question).
2. The LLM decides which tools to call, up to a step cap.
3. Tools fetch live data from Stellar Horizon. The math (slippage, stats) runs in code, not in the model.
4. The agent returns a structured answer: text, verdict, evidence, and the tool trace.
5. Your feedback is stored and included in the next request.

### Agent tools

| Tool | Purpose |
|------|---------|
| `get_trades` | Recent trades for an address |
| `get_order_book` | Live bids and asks for an asset pair |
| `get_asset_info` | Holder count and supply for an asset |
| `check_issuer` | Issuer home domain and `stellar.toml` lookup |
| `estimate_slippage` | Average fill price and slippage, computed in code |

## Tech stack

- **Frontend:** React (Vite)
- **Backend:** Node.js + Express
- **Stellar:** `@stellar/stellar-sdk` against the public Horizon API
- **AI:** an LLM with tool calling, called from the backend only

## Getting started

### Prerequisites

- Node.js 18 or later
- An API key for your LLM provider

### Install

```bash
git clone <your-repo-url>
cd <your-repo-folder>
npm install
```

### Configure

Create a `.env` file in the project root:

```bash
HORIZON_URL=https://horizon.stellar.org
LLM_API_KEY=your-key-here
```

`HORIZON_URL` points at the public mainnet Horizon, which the agent only reads from. Use `https://horizon-testnet.stellar.org` if you want testnet data instead (testnet accounts usually have very little trade history).

### Known assets

Add the assets you want the agent to recognize in `config/assets.js`. Fill in each issuer address yourself and verify it against that issuer's own `stellar.toml`. Do not copy issuer addresses from third-party sources.

### Run

```bash
npm run dev
```

Then open the local URL printed in the terminal and paste a busy mainnet address to start.

## Demo script (about 90 seconds)

1. Paste a busy mainnet address and show the profile and first insights.
2. Ask: "Is it safe to swap 500 XLM to USDC?" and watch the agent trace.
3. Rate a few answers, regenerate, and show how the agent's focus changed.

## Safety and limits

- **Read-only.** No wallet connection, no keys, no signing, no transactions.
- **Validated inputs.** Every tool validates its arguments (address format, asset codes) before calling Horizon.
- **Step cap.** The agent loop stops after a fixed number of tool calls.
- **Math in code.** The model explains results but does not compute them.
- **Fallbacks.** If Horizon or the LLM fails, the app shows a friendly error and uses saved sample data where available.
- **Public rate limits.** The public Horizon instance is shared, so heavy use may be throttled.
- **Insights only, not financial advice.** Output is behavior insight and market context, not a recommendation to buy or sell.

## Roadmap

- Limit orders by sentence (`manageSellOffer`), with a preview and user signing
- Conditional payments using claimable balances
- Wider asset coverage and saved profiles

## License

Add your license here.
