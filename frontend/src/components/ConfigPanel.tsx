import { useState } from "react";
import { SymbolInfo } from "../App";

interface Props {
  symbols: SymbolInfo[];
  running: boolean;
  loading: boolean;
  onStart: (config: any) => void;
  onStop: () => void;
}

export default function ConfigPanel({ symbols, running, loading, onStart, onStop }: Props) {
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [mode, setMode] = useState<"long" | "short" | "neutral">("neutral");
  const [gridCount, setGridCount] = useState(10);
  const [spread, setSpread] = useState(4);
  const [quantityPerGrid, setQuantityPerGrid] = useState(50);
  const [leverage, setLeverage] = useState(5);

  const perGridProfit = quantityPerGrid * (spread / 200);
  const perGridProfitPercent = spread / 2;
  const feePerTrade = quantityPerGrid * 0.0004 * 2;
  const netPerGrid = perGridProfit - feePerTrade;
  const totalInvest = quantityPerGrid * gridCount / leverage;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStart({ symbol, mode, gridCount, spreadPercent: spread, quantityPerGrid, leverage });
  };

  return (
    <div className="panel">
      <h2 className="panel-title">网格配置</h2>
      <form onSubmit={handleSubmit} className="form">
        <div className="field">
          <label className="label">交易对</label>
          <select
            className="select"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            disabled={running}
          >
            {symbols.length > 0
              ? symbols.map((s) => (
                  <option key={s.symbol} value={s.symbol}>
                    {s.baseAsset}/USDT
                  </option>
                ))
              : ["BTCUSDT", "ETHUSDT", "SOLUSDT", "AVAXUSDT"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
          </select>
        </div>

        <div className="field">
          <label className="label">模式</label>
          <div className="mode-buttons">
            {([
              { key: "long" as const, label: "做多", color: "#22c55e" },
              { key: "short" as const, label: "做空", color: "#ef4444" },
              { key: "neutral" as const, label: "中性", color: "#3b82f6" },
            ]).map((m) => (
              <button
                key={m.key}
                type="button"
                className={"mode-btn" + (mode === m.key ? " active" : "")}
                style={{
                  borderColor: mode === m.key ? m.color : undefined,
                  color: mode === m.key ? m.color : undefined,
                }}
                onClick={() => setMode(m.key)}
                disabled={running}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="row">
          <div className="field">
            <label className="label">网格数量</label>
            <input
              type="number"
              className="input"
              value={gridCount}
              min={3}
              max={50}
              onChange={(e) => setGridCount(parseInt(e.target.value) || 10)}
              disabled={running}
            />
          </div>
          <div className="field">
            <label className="label">网格跨度 %</label>
            <input
              type="number"
              className="input"
              value={spread}
              min={0.5}
              max={50}
              step={0.5}
              onChange={(e) => setSpread(parseFloat(e.target.value) || 4)}
              disabled={running}
            />
          </div>
        </div>

        <div className="row">
          <div className="field">
            <label className="label">每格金额 (USDT)</label>
            <input
              type="number"
              className="input"
              value={quantityPerGrid}
              min={10}
              step={10}
              onChange={(e) => setQuantityPerGrid(parseFloat(e.target.value) || 50)}
              disabled={running}
            />
          </div>
          <div className="field">
            <label className="label">杠杆倍数</label>
            <input
              type="number"
              className="input"
              value={leverage}
              min={1}
              max={50}
              onChange={(e) => setLeverage(parseInt(e.target.value) || 5)}
              disabled={running}
            />
          </div>
        </div>

        {!running && (
          <div className="preview-box">
            <div className="preview-title">收益预估</div>
            <div className="preview-grid">
              <div className="preview-item">
                <span className="preview-label">每格收益</span>
                <span className="preview-val" style={{ color: "var(--green)" }}>
                  ${perGridProfit.toFixed(2)}
                </span>
                <span className="preview-sub">{perGridProfitPercent.toFixed(2)}%</span>
              </div>
              <div className="preview-item">
                <span className="preview-label">每笔手续费</span>
                <span className="preview-val">${feePerTrade.toFixed(2)}</span>
                <span className="preview-sub">maker 0.04% × 2</span>
              </div>
              <div className="preview-item">
                <span className="preview-label">净收益/格</span>
                <span className="preview-val" style={{ color: netPerGrid > 0 ? "var(--green)" : "var(--red)" }}>
                  ${netPerGrid.toFixed(2)}
                </span>
                <span className="preview-sub">收益 - 手续费</span>
              </div>
              <div className="preview-item">
                <span className="preview-label">总投入保证金</span>
                <span className="preview-val">${totalInvest.toFixed(2)}</span>
                <span className="preview-sub">{gridCount} 格 × ${quantityPerGrid} / {leverage}x</span>
              </div>
            </div>
          </div>
        )}

        {mode === "long" && (
          <div className="hint">
            做多模式：在当前价下方挂买单，上方挂卖单。价格震荡上行时获利。
          </div>
        )}
        {mode === "short" && (
          <div className="hint">
            做空模式：在当前价上方挂卖单，下方挂买单。价格震荡下行时获利。
          </div>
        )}
        {mode === "neutral" && (
          <div className="hint">
            中性模式：不持有初始仓位，围绕当前价双向挂单。横盘震荡时获利。
          </div>
        )}

        {!running ? (
          <button
            type="submit"
            className="btn btn-start"
            disabled={loading}
          >
            {loading ? "启动中..." : "启动网格"}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-stop"
            onClick={onStop}
            disabled={loading}
          >
            {loading ? "停止中..." : "停止网格"}
          </button>
        )}
      </form>
    </div>
  );
}
