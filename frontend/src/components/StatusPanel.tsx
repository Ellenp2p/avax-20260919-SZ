import { GridStatus } from "../App";

interface Props {
  status: GridStatus | null;
}

function formatTime(ts: number | null): string {
  if (!ts) return "-";
  const s = Math.floor((Date.now() - ts) / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h + "时 " + m + "分 " + sec + "秒";
}

function fmt(v: number | string, decimals = 2): string {
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(n)) return "0.00";
  return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function pnlColor(v: string | number): string {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return isNaN(n) || n === 0 ? "var(--text-muted)" : n > 0 ? "var(--green)" : "var(--red)";
}

const MODE_CN: Record<string, string> = { long: "做多", short: "做空", neutral: "中性" };

export default function StatusPanel({ status }: Props) {
  if (!status) {
    return (
      <div className="panel">
        <div className="loading">加载中...</div>
      </div>
    );
  }

  const p = status.position;
  const buyLevels = status.gridLevels.filter((l) => l.side === "BUY");
  const sellLevels = status.gridLevels.filter((l) => l.side === "SELL");
  const activeBuy = buyLevels.filter((l) => !l.filled && l.orderId).length;
  const activeSell = sellLevels.filter((l) => !l.filled && l.orderId).length;

  const liqPrice = p ? parseFloat(p.liquidationPrice) : 0;
  const liqDist = status.liquidationDistance;
  const liqBarWidth = Math.min(liqDist, 100);
  const liqColor = liqDist < 10 ? "var(--red)" : liqDist < 30 ? "var(--yellow)" : "var(--green)";

  return (
    <div className="panel">
      <h2 className="panel-title">
        运行状态
        <span
          style={{
            padding: "2px 8px",
            borderRadius: "4px",
            fontSize: "11px",
            fontWeight: 700,
            background: status.running ? "rgba(34,197,94,0.2)" : "var(--border-light)",
            color: status.running ? "var(--green)" : "var(--text-muted)",
          }}
        >
          {status.running ? "运行中" : "已停止"}
        </span>
      </h2>

      <div className="metrics">
        <div className="metric">
          <span className="metric-label">最新价</span>
          <span className="metric-value">${fmt(status.currentPrice)}</span>
        </div>
        <div className="metric">
          <span className="metric-label">标记价</span>
          <span className="metric-value" style={{ fontSize: "16px" }}>${fmt(status.markPrice)}</span>
        </div>
        <div className="metric">
          <span className="metric-label">运行时间</span>
          <span className="metric-value" style={{ fontSize: "14px" }}>{formatTime(status.startTime)}</span>
        </div>
        <div className="metric">
          <span className="metric-label">已成交</span>
          <span className="metric-value">{status.filledCount}</span>
        </div>
      </div>

      {status.config && (
        <div className="config-row">
          <span className="config-tag">{status.config.symbol}</span>
          <span
            className="config-tag"
            style={{
              color: status.config.mode === "long" ? "var(--green)" : status.config.mode === "short" ? "var(--red)" : "var(--blue)",
            }}
          >
            {MODE_CN[status.config.mode] || status.config.mode}
          </span>
          <span className="config-tag">{status.config.gridCount} 格</span>
          <span className="config-tag">{status.config.leverage}x 杠杆</span>
        </div>
      )}

      {p && (
        <div className="position-box">
          <div className="position-header">
            <span
              className="side-tag"
              style={{
                background: p.side === "LONG" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                color: p.side === "LONG" ? "var(--green)" : "var(--red)",
              }}
            >
              {p.side === "LONG" ? "多" : "空"}
            </span>
            <span className="position-size">{p.size} {status.config?.symbol.replace("USDT", "")}</span>
            <span className="position-notional">${fmt(p.notional)}</span>
          </div>

          <div className="pos-grid">
            <div className="pos-item">
              <span className="pos-label">开仓均价</span>
              <span className="pos-val">${fmt(p.entryPrice)}</span>
            </div>
            <div className="pos-item">
              <span className="pos-label">未实现盈亏</span>
              <span className="pos-val" style={{ color: pnlColor(p.unrealizedPnl) }}>
                ${fmt(p.unrealizedPnl)}
              </span>
            </div>
            <div className="pos-item">
              <span className="pos-label">杠杆</span>
              <span className="pos-val">{p.leverage}x</span>
            </div>
          </div>

          {liqPrice > 0 && (
            <div className="liq-section">
              <div className="liq-header">
                <span className="liq-label">爆仓价</span>
                <span className="liq-price" style={{ color: liqColor }}>${fmt(liqPrice)}</span>
                <span className="liq-dist-badge" style={{ background: liqColor + "22", color: liqColor }}>
                  距爆仓 {fmt(liqDist, 1)}%
                </span>
              </div>
              <div className="liq-bar-bg">
                <div className="liq-bar-fill" style={{ width: `${100 - liqBarWidth}%`, background: liqColor }} />
                <div className="liq-marker" />
              </div>
              <div className="liq-range">
                <span className="liq-range-label">当前 ${fmt(status.markPrice)}</span>
                <span className="liq-range-label">爆仓 ${fmt(liqPrice)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Grid Stats */}
      <div className="stats-box">
        <h3 className="stats-title">网格统计</h3>
        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-label">每格利润</span>
            <span className="stat-val" style={{ color: "var(--green)" }}>
              ${fmt(status.perGridProfitUsdt, 4)}
            </span>
            <span className="stat-sub">{fmt(status.perGridProfitPercent, 4)}%</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">网格区间</span>
            <span className="stat-val">
              ${fmt(status.gridLowerPrice)} — ${fmt(status.gridUpperPrice)}
            </span>
            <span className="stat-sub">
              {fmt((status.gridUpperPrice / status.gridLowerPrice - 1) * 100, 2)}% 跨度
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">总投入保证金</span>
            <span className="stat-val">${fmt(status.totalMargin)}</span>
            <span className="stat-sub">
              {status.filledCount} 笔成交 / {status.gridLevels.filter((l) => !l.filled && l.orderId).length} 笔挂单中
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">资金费率</span>
            <span className="stat-val" style={{ color: parseFloat(status.fundingRate) > 0 ? "var(--green)" : parseFloat(status.fundingRate) < 0 ? "var(--red)" : "var(--text-muted)" }}>
              {status.fundingRate || "N/A"}
            </span>
            <span className="stat-sub">1h 费率</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">总成交次数</span>
            <span className="stat-val">{status.filledCount}</span>
            <span className="stat-sub">
              {status.gridLevels.filter((l) => l.filled).length} / {status.gridLevels.length} 格已触发
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">已实现盈亏</span>
            <span className="stat-val" style={{ color: pnlColor(status.totalPnl) }}>
              ${fmt(status.totalPnl)}
            </span>
            <span className="stat-sub">累计</span>
          </div>
        </div>
      </div>

      {/* Grid Orders Bar */}
      <div>
        <div className="grid-bar-label">挂单分布</div>
        <div className="grid-bar-row">
          <span className="buy-text">买 {activeBuy}</span>
          <div className="grid-bar-bg">
            <div className="grid-bar-fill" style={{ width: `${status.gridLevels.length > 0 ? (activeBuy / status.gridLevels.length) * 100 : 0}%`, background: "var(--green)" }} />
            <div className="grid-bar-fill" style={{ width: `${status.gridLevels.length > 0 ? (activeSell / status.gridLevels.length) * 100 : 0}%`, background: "var(--red)" }} />
          </div>
          <span className="sell-text">卖 {activeSell}</span>
        </div>
      </div>

      {status.errors.length > 0 && (
        <div className="error-box">
          {status.errors.slice(-3).map((e, i) => (
            <div key={i} className="error-line">{e}</div>
          ))}
        </div>
      )}
    </div>
  );
}
