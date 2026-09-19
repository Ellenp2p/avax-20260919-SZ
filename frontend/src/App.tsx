import { useState, useEffect, useCallback } from "react";
import ConfigPanel from "./components/ConfigPanel";
import StatusPanel from "./components/StatusPanel";
import OrderList from "./components/OrderList";
import "./index.css";

export interface GridStatus {
  running: boolean;
  config: {
    symbol: string;
    mode: string;
    gridCount: number;
    spreadPercent: number;
    quantityPerGrid: number;
    leverage: number;
  } | null;
  currentPrice: number;
  markPrice: number;
  position: {
    side: string;
    size: string;
    entryPrice: string;
    unrealizedPnl: string;
    leverage: string;
    liquidationPrice: string;
    notional: string;
  } | null;
  gridLevels: Array<{
    index: number;
    price: number;
    side: string;
    orderId: number | null;
    filled: boolean;
  }>;
  totalPnl: number;
  filledCount: number;
  startTime: number | null;
  errors: string[];
  perGridProfitUsdt: number;
  perGridProfitPercent: number;
  gridUpperPrice: number;
  gridLowerPrice: number;
  totalMargin: number;
  liquidationDistance: number;
  fundingRate: string;
}

export interface SymbolInfo {
  symbol: string;
  baseAsset: string;
  pricePrecision: number;
  quantityPrecision: number;
}

const API = "";

export default function App() {
  const [status, setStatus] = useState<GridStatus | null>(null);
  const [symbols, setSymbols] = useState<SymbolInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    return (localStorage.getItem("theme") as "dark" | "light") || "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/status`);
      const data = await res.json();
      setStatus(data.status);
    } catch {}
  }, []);

  const fetchSymbols = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/exchangeInfo`);
      const data = await res.json();
      setSymbols(data.symbols || []);
    } catch {}
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchSymbols();
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, [fetchStatus, fetchSymbols]);

  const handleStart = async (config: any) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/api/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!data.ok) setError(data.error || "启动失败");
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  const handleStop = async () => {
    setLoading(true);
    try {
      await fetch(`${API}/api/stop`, { method: "POST" });
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">Primit 网格机器人</h1>
        <span className="app-badge">测试网</span>
        <button
          className="theme-toggle"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? "日间模式" : "夜间模式"}
        </button>
      </header>

      {error && <div className="error-msg">{error}</div>}

      <div className="app-grid">
        <div>
          <ConfigPanel
            symbols={symbols}
            running={status?.running || false}
            loading={loading}
            onStart={handleStart}
            onStop={handleStop}
          />
        </div>
        <div className="app-right">
          <StatusPanel status={status} />
          <OrderList levels={status?.gridLevels || []} />
        </div>
      </div>
    </div>
  );
}
