import { PrimitClient, TESTNET, MAINNET } from "./primit-client";
import { GridEngine, GridConfig } from "./grid-engine";

const config = process.env.PRIMIT_NETWORK === "mainnet" ? MAINNET : TESTNET;
const client = new PrimitClient(config);
const engine = new GridEngine(client);

function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

function htmlResponse(html: string): Response {
  return new Response(html, {
    headers: { "Content-Type": "text/html" },
  });
}

const PORT = parseInt(process.env.PORT || "3001");
const ROOT = process.cwd();

const FALLBACK_HTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Primit Grid Bot</title>
<style>
  body{font-family:monospace;background:#0a0a0f;color:#e0e0e0;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0}
  .box{text-align:center;max-width:500px;padding:40px}
  h1{font-size:28px;color:#fff;margin-bottom:16px}
  p{color:#888;line-height:1.6}
  code{background:#1a1a24;padding:2px 8px;border-radius:4px;color:#ff6b35}
</style></head><body>
<div class="box">
  <h1>Primit Grid Bot</h1>
  <p>Frontend not built yet. Run:<br><code>bun run build</code></p>
</div>
</body></html>`;

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // API routes
    if (path === "/api/status") {
      return jsonResponse({
        status: engine.getStatus(),
        network: process.env.PRIMIT_NETWORK || "testnet",
      });
    }

    if (path === "/api/start" && req.method === "POST") {
      try {
        const body = (await req.json()) as GridConfig;
        await engine.start(body);
        return jsonResponse({ ok: true });
      } catch (e: any) {
        return jsonResponse({ ok: false, error: e.message }, 400);
      }
    }

    if (path === "/api/stop" && req.method === "POST") {
      try {
        await engine.stop();
        return jsonResponse({ ok: true });
      } catch (e: any) {
        return jsonResponse({ ok: false, error: e.message }, 400);
      }
    }

    if (path === "/api/orders") {
      try {
        const symbol = url.searchParams.get("symbol") || undefined;
        const orders = await client.getOpenOrders(symbol);
        return jsonResponse({ orders });
      } catch (e: any) {
        return jsonResponse({ orders: [], error: e.message });
      }
    }

    if (path === "/api/positions") {
      try {
        const symbol = url.searchParams.get("symbol") || undefined;
        const positions = await client.getPositions(symbol);
        return jsonResponse({ positions });
      } catch (e: any) {
        return jsonResponse({ positions: [], error: e.message });
      }
    }

    if (path === "/api/ticker") {
      try {
        const symbol = url.searchParams.get("symbol") || "BTCUSDT";
        const ticker = await client.ticker(symbol);
        return jsonResponse({ ticker });
      } catch (e: any) {
        return jsonResponse({ ticker: null, error: e.message });
      }
    }

    if (path === "/api/exchangeInfo") {
      try {
        const info = await client.exchangeInfo();
        return jsonResponse({
          symbols: info.symbols
            .filter((s) => s.status === "TRADING" && s.contractType === "PERPETUAL")
            .map((s) => ({
              symbol: s.symbol,
              baseAsset: s.baseAsset,
              pricePrecision: s.pricePrecision,
              quantityPrecision: s.quantityPrecision,
            })),
        });
      } catch (e: any) {
        return jsonResponse({ symbols: [], error: e.message });
      }
    }

    // Serve frontend static files
    const filePath = path === "/" ? "/index.html" : path;
    const distPath = `${ROOT}/frontend/dist${filePath}`;
    const file = Bun.file(distPath);
    if (await file.exists()) {
      return new Response(file);
    }

    return htmlResponse(FALLBACK_HTML);
  },
});

console.log(`\n  Primit Grid Bot running on http://localhost:${PORT}\n`);
console.log(`  Network: ${process.env.PRIMIT_NETWORK || "testnet"}`);

try {
  const platform = process.platform;
  if (platform === "win32") {
    Bun.spawn(["cmd", "/c", "start", `http://localhost:${PORT}`]);
  } else if (platform === "darwin") {
    Bun.spawn(["open", `http://localhost:${PORT}`]);
  } else {
    Bun.spawn(["xdg-open", `http://localhost:${PORT}`]);
  }
} catch {}
