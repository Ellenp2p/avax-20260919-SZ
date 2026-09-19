# Primit Grid Bot

A geometric grid trading bot for [Primit](https://primit.io) perpetual DEX on Avalanche. Supports **Long**, **Short**, and **Neutral** modes with configurable leverage, grid count, and spread.

## Features

- **Geometric grid**: equal percentage spacing between levels, ideal for volatile crypto markets
- **Three modes**: Long / Short / Neutral — pick your directional bias or run both-sided
- **Auto re-ordering**: filled grid orders are automatically replaced to keep the grid working
- **Real-time dashboard**: React UI with live status, positions, and open orders via WebSocket
- **Configurable leverage, grid count, and spread**

## Tech Stack

- **Backend**: Bun + TypeScript (HMAC auth, REST + WebSocket)
- **Frontend**: React + Vite
- **API**: Primit Binance-compatible API (testnet: `api.primit.xyz`)

## Setup

### 1. Get API Keys

Go to [Primit Testnet](https://primit.xyz), create an API key with **trading permissions**.

### 2. Configure

```bash
cp .env.example .env
# Edit .env with your API key/secret
```

### 3. Install & Run

```bash
# Install frontend dependencies
cd frontend && bun install && bun run build && cd ..

# Start backend (serves API + frontend)
bun run start
```

Open `http://localhost:3001` in your browser.

### Development Mode

```bash
# Terminal 1: backend
bun run dev

# Terminal 2: frontend (with HMR)
cd frontend && bun run dev
```

Frontend dev server runs on `http://localhost:5173` with API proxy to backend.

## Grid Modes

| Mode | Description | Risk |
|------|-------------|------|
| **Long** | Opens long position, buys dips, sells rips | Liquidation if price drops |
| **Short** | Opens short position, sells peaks, buys dips | Liquidation if price rises |
| **Neutral** | No initial position, buys below/above current price | Both-sided risk |

## Geometric Grid

Grid levels are calculated with **equal percentage spacing** between each level, which works better than arithmetic grids for volatile crypto markets.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/status` | Bot status, position, grid levels |
| `POST` | `/api/start` | Start grid with config |
| `POST` | `/api/stop` | Stop grid, cancel all orders |
| `GET` | `/api/orders?symbol=` | Open orders |
| `GET` | `/api/positions?symbol=` | Current positions |
| `GET` | `/api/ticker?symbol=` | 24hr ticker |
| `GET` | `/api/exchangeInfo` | Available symbols |

## Architecture

```
backend/src/
├── primit-client.ts   # Primit API client (HMAC signing, REST, WebSocket)
├── grid-engine.ts     # Grid logic (geometric calc, order mgmt, fill re-order)
├── server.ts          # Bun HTTP server
└── index.ts           # Entry point

frontend/src/
├── App.tsx            # Main app
└── components/
    ├── ConfigPanel.tsx  # Grid config form
    ├── StatusPanel.tsx  # Real-time status
    └── OrderList.tsx    # Active orders
```

## Disclaimer

Trading perpetual futures carries substantial risk of loss. This software is for educational purposes; use at your own risk, preferably on testnet first.
