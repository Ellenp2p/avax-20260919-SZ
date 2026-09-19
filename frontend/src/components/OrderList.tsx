interface GridLevel {
  index: number;
  price: number;
  side: string;
  orderId: number | null;
  filled: boolean;
}

interface Props {
  levels: GridLevel[];
}

export default function OrderList({ levels }: Props) {
  const sorted = [...levels].sort((a, b) => b.price - a.price);

  return (
    <div className="panel">
      <h2 className="panel-title">
        网格挂单
        <span className="count-badge">{levels.length}</span>
      </h2>

      <div className="order-table">
        <div className="order-header">
          <span className="order-th">价格</span>
          <span className="order-th" style={{ textAlign: "center" }}>方向</span>
          <span className="order-th" style={{ textAlign: "center" }}>状态</span>
        </div>
        {sorted.length === 0 && (
          <div className="order-empty">暂无挂单</div>
        )}
        {sorted.map((l) => (
          <div key={l.index} className="order-row">
            <span className="order-cell order-price">
              ${l.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
            <span
              className="order-cell"
              style={{
                textAlign: "center",
                color: l.side === "BUY" ? "var(--green)" : "var(--red)",
                fontWeight: 600,
              }}
            >
              {l.side === "BUY" ? "买入" : "卖出"}
            </span>
            <span className="order-cell" style={{ textAlign: "center" }}>
              {l.filled ? (
                <span className="tag-filled">已成交</span>
              ) : l.orderId ? (
                <span className="tag-active">挂单中</span>
              ) : (
                <span className="tag-pending">等待中</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
