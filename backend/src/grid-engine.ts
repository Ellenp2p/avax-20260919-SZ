import { PrimitClient, OrderParams, PositionInfo, OpenOrder } from "./primit-client";

export type GridMode = "long" | "short" | "neutral";

export interface GridConfig {
  symbol: string;
  mode: GridMode;
  gridCount: number;
  spreadPercent: number;
  quantityPerGrid: number;
  leverage: number;
}

export interface GridLevel {
  index: number;
  price: number;
  side: "BUY" | "SELL";
  orderId: number | null;
  filled: boolean;
  clientOrderId: string;
}

export interface GridStatus {
  running: boolean;
  config: GridConfig | null;
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
  gridLevels: GridLevel[];
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

function roundPrice(price: number, tickSize: number): number {
  const precision = Math.max(0, Math.round(-Math.log10(tickSize)));
  const rounded = Math.round(price / tickSize) * tickSize;
  return parseFloat(rounded.toFixed(precision));
}

function roundQty(qty: number, stepSize: number): number {
  const precision = Math.max(0, Math.round(-Math.log10(stepSize)));
  const rounded = Math.round(qty / stepSize) * stepSize;
  return parseFloat(rounded.toFixed(precision));
}

export class GridEngine {
  private client: PrimitClient;
  private config: GridConfig | null = null;
  private gridLevels: GridLevel[] = [];
  private currentPrice = 0;
  private tickSize = 0.01;
  private stepSize = 1;
  private running = false;
  private startTime: number | null = null;
  private position: PositionInfo | null = null;
  private totalPnl = 0;
  private filledCount = 0;
  private errors: string[] = [];
  private orderCheckInterval: ReturnType<typeof setInterval> | null = null;
  private tickerInterval: ReturnType<typeof setInterval> | null = null;
  private gridUpperPrice = 0;
  private gridLowerPrice = 0;
  private perGridProfitUsdt = 0;
  private perGridProfitPercent = 0;
  private markPrice = 0;
  private fundingRate = "0";

  constructor(client: PrimitClient) {
    this.client = client;
  }

  private log(msg: string): void {
    console.log(`[Grid] ${msg}`);
  }

  async initExchangeInfo(symbol: string): Promise<void> {
    const info = await this.client.exchangeInfo();
    const sym = info.symbols.find((s) => s.symbol === symbol);
    if (!sym) throw new Error(`Symbol ${symbol} not found`);

    const priceFilter = sym.filters.find((f) => f.filterType === "PRICE_FILTER");
    const lotFilter = sym.filters.find((f) => f.filterType === "LOT_SIZE");
    if (priceFilter?.tickSize) this.tickSize = parseFloat(priceFilter.tickSize);
    if (lotFilter?.stepSize) this.stepSize = parseFloat(lotFilter.stepSize);
    if (lotFilter?.minQty) {
      this.log(`Lot size: step=${this.stepSize}, min=${lotFilter.minQty}`);
    }
  }

  calculateGeometricGrid(currentPrice: number, gridCount: number, spreadPercent: number): number[] {
    const halfSpread = spreadPercent / 200;
    const upperPrice = currentPrice * Math.pow(1 + halfSpread, gridCount);
    const lowerPrice = currentPrice * Math.pow(1 - halfSpread, gridCount);
    const ratio = Math.pow(upperPrice / lowerPrice, 1 / (2 * gridCount));
    const levels: number[] = [];
    for (let i = 0; i < 2 * gridCount + 1; i++) {
      levels.push(roundPrice(lowerPrice * Math.pow(ratio, i), this.tickSize));
    }
    return levels;
  }

  async start(config: GridConfig): Promise<void> {
    if (this.running) throw new Error("Grid already running");
    this.config = config;
    this.errors = [];
    this.filledCount = 0;
    this.totalPnl = 0;

    await this.initExchangeInfo(config.symbol);

    await this.client.changeLeverage(config.symbol, config.leverage);
    this.log(`Leverage set to ${config.leverage}x`);

    const ticker = await this.client.ticker(config.symbol);
    this.currentPrice = parseFloat(ticker.last_price);
    this.log(`Current price: ${this.currentPrice}`);

    const allPrices = this.calculateGeometricGrid(
      this.currentPrice,
      config.gridCount,
      config.spreadPercent
    );

    this.gridLevels = [];

    this.gridLowerPrice = allPrices[0];
    this.gridUpperPrice = allPrices[allPrices.length - 1];
    this.perGridProfitPercent = (Math.pow(allPrices[1] / allPrices[0], 1) - 1) * 100;
    this.perGridProfitUsdt = config.quantityPerGrid * (allPrices[1] / allPrices[0] - 1);
    this.markPrice = this.currentPrice;
    this.log(`Grid range: ${this.gridLowerPrice} - ${this.gridUpperPrice}`);
    this.log(`Per grid profit: ${this.perGridProfitPercent.toFixed(4)}% ($${this.perGridProfitUsdt.toFixed(4)})`);

    if (config.mode === "long") {
      const buyPrices = allPrices.filter((p) => p < this.currentPrice).slice(-config.gridCount);
      const sellPrices = allPrices.filter((p) => p >= this.currentPrice).slice(0, config.gridCount);
      for (let i = 0; i < buyPrices.length; i++) {
        this.gridLevels.push({
          index: i,
          price: buyPrices[i],
          side: "BUY",
          orderId: null,
          filled: false,
          clientOrderId: `grid_long_buy_${i}_${Date.now()}`,
        });
      }
      for (let i = 0; i < sellPrices.length; i++) {
        this.gridLevels.push({
          index: buyPrices.length + i,
          price: sellPrices[i],
          side: "SELL",
          orderId: null,
          filled: false,
          clientOrderId: `grid_long_sell_${i}_${Date.now()}`,
        });
      }
    } else if (config.mode === "short") {
      const sellPrices = allPrices.filter((p) => p > this.currentPrice).slice(0, config.gridCount);
      const buyPrices = allPrices.filter((p) => p <= this.currentPrice).slice(-config.gridCount);
      for (let i = 0; i < sellPrices.length; i++) {
        this.gridLevels.push({
          index: i,
          price: sellPrices[i],
          side: "SELL",
          orderId: null,
          filled: false,
          clientOrderId: `grid_short_sell_${i}_${Date.now()}`,
        });
      }
      for (let i = 0; i < buyPrices.length; i++) {
        this.gridLevels.push({
          index: sellPrices.length + i,
          price: buyPrices[i],
          side: "BUY",
          orderId: null,
          filled: false,
          clientOrderId: `grid_short_buy_${i}_${Date.now()}`,
        });
      }
    } else {
      // neutral
      const buyPrices = allPrices.filter((p) => p < this.currentPrice).slice(-config.gridCount);
      const sellPrices = allPrices.filter((p) => p > this.currentPrice).slice(0, config.gridCount);
      for (let i = 0; i < buyPrices.length; i++) {
        this.gridLevels.push({
          index: i,
          price: buyPrices[i],
          side: "BUY",
          orderId: null,
          filled: false,
          clientOrderId: `grid_neutral_buy_${i}_${Date.now()}`,
        });
      }
      for (let i = 0; i < sellPrices.length; i++) {
        this.gridLevels.push({
          index: buyPrices.length + i,
          price: sellPrices[i],
          side: "SELL",
          orderId: null,
          filled: false,
          clientOrderId: `grid_neutral_sell_${i}_${Date.now()}`,
        });
      }
    }

    this.log(`Created ${this.gridLevels.length} grid levels`);

    const qty = roundQty(config.quantityPerGrid / this.currentPrice, this.stepSize);
    const orders: OrderParams[] = this.gridLevels.map((level) => ({
      symbol: config.symbol,
      side: level.side,
      type: "LIMIT" as const,
      quantity: String(qty),
      price: String(level.price),
      timeInForce: "GTC" as const,
      newClientOrderId: level.clientOrderId,
    }));

    this.log(`Placing ${orders.length} limit orders (qty=${qty} each)`);

    try {
      const batchResult = await this.client.batchNewOrders(orders);
      if (Array.isArray(batchResult)) {
        for (let i = 0; i < batchResult.length && i < this.gridLevels.length; i++) {
          const r = batchResult[i];
          if (r && r.orderId) {
            this.gridLevels[i].orderId = r.orderId;
          } else if (r && r.code) {
            this.errors.push(`Order ${i} failed: ${r.code} ${r.msg}`);
            this.log(`Order ${i} failed: ${r.code} ${r.msg}`);
          }
        }
      }
    } catch (e: any) {
      this.errors.push(`Batch order failed: ${e.message}`);
      this.log(`Batch order failed: ${e.message}`);
    }

    this.running = true;
    this.startTime = Date.now();
    this.log("Grid started!");

    this.orderCheckInterval = setInterval(() => this.checkOrders(), 5000);
    this.tickerInterval = setInterval(() => this.updateTicker(), 30000);
    this.updateTicker();
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;
    if (this.orderCheckInterval) clearInterval(this.orderCheckInterval);
    if (this.tickerInterval) clearInterval(this.tickerInterval);

    if (this.config) {
      try {
        await this.client.cancelAllOrders(this.config.symbol);
        this.log("All orders cancelled");
      } catch (e: any) {
        this.errors.push(`Cancel orders failed: ${e.message}`);
      }
    }

    for (const level of this.gridLevels) {
      level.orderId = null;
    }
    this.log("Grid stopped");
  }

  private async checkOrders(): Promise<void> {
    if (!this.running || !this.config) return;

    try {
      const openOrders = await this.client.getOpenOrders(this.config.symbol);
      const openOrderIds = new Set(openOrders.map((o) => o.orderId));

      for (const level of this.gridLevels) {
        if (level.filled) continue;
        if (level.orderId && openOrderIds.has(level.orderId)) continue;
        if (level.orderId && !openOrderIds.has(level.orderId)) {
          level.filled = true;
          level.orderId = null;
          this.filledCount++;
          this.log(`Order filled: ${level.side} @ ${level.price}`);

          await this.reOrderAfterFill(level);
        }
      }

      const positions = await this.client.getPositions(this.config.symbol);
      this.position = positions.find(
        (p) => parseFloat(p.positionAmt) !== 0
      ) || null;
    } catch (e: any) {
      this.errors.push(`Check orders error: ${e.message}`);
    }
  }

  private async reOrderAfterFill(filledLevel: GridLevel): Promise<void> {
    if (!this.config) return;

    const qty = roundQty(this.config.quantityPerGrid / this.currentPrice, this.stepSize);

    const oppositeSide = filledLevel.side === "BUY" ? "SELL" : "BUY";

    const allPrices = this.calculateGeometricGrid(
      this.currentPrice,
      this.config.gridCount,
      this.config.spreadPercent
    );

    let targetPrice: number;
    if (oppositeSide === "SELL") {
      targetPrice = allPrices.find((p) => p > filledLevel.price) || filledLevel.price * 1.01;
    } else {
      const below = allPrices.filter((p) => p < filledLevel.price);
      targetPrice = below.length > 0 ? below[below.length - 1] : filledLevel.price * 0.99;
    }
    targetPrice = roundPrice(targetPrice, this.tickSize);

    const newClientOrderId = `grid_reorder_${filledLevel.index}_${Date.now()}`;
    try {
      const result = await this.client.newOrder({
        symbol: this.config.symbol,
        side: oppositeSide,
        type: "LIMIT",
        quantity: String(qty),
        price: String(targetPrice),
        timeInForce: "GTC",
        newClientOrderId,
      });

      if (result && result.orderId) {
        filledLevel.filled = false;
        filledLevel.side = oppositeSide;
        filledLevel.price = targetPrice;
        filledLevel.orderId = result.orderId;
        filledLevel.clientOrderId = newClientOrderId;
        this.log(`Re-ordered: ${oppositeSide} @ ${targetPrice}`);
      }
    } catch (e: any) {
      this.errors.push(`Re-order failed: ${e.message}`);
      this.log(`Re-order failed: ${e.message}`);
    }
  }

  async updatePrice(price: number): Promise<void> {
    this.currentPrice = price;
  }

  private async updateTicker(): Promise<void> {
    if (!this.config) return;
    try {
      const t = await this.client.ticker(this.config.symbol);
      this.markPrice = parseFloat(t.mark_price);
      this.currentPrice = parseFloat(t.last_price);
      if ((t as any).funding_rate_1h !== undefined) {
        this.fundingRate = String((t as any).funding_rate_1h);
      }
    } catch {}
  }

  getStatus(): GridStatus {
    const liquidationPrice = this.position?.liquidationPrice || "0";
    const liqPrice = parseFloat(liquidationPrice);
    const liqDistance = liqPrice > 0
      ? Math.abs((this.markPrice - liqPrice) / this.markPrice) * 100
      : 0;

    let totalMargin = 0;
    if (this.position) {
      const notional = parseFloat(this.position.notional || "0");
      totalMargin += Math.abs(notional) / parseFloat(this.position.leverage || "1");
    }
    if (this.config) {
      for (const level of this.gridLevels) {
        if (!level.filled && level.orderId) {
          totalMargin += this.config.quantityPerGrid;
        }
      }
    }

    return {
      running: this.running,
      config: this.config,
      currentPrice: this.currentPrice,
      markPrice: this.markPrice,
      position: this.position
        ? {
            side: parseFloat(this.position.positionAmt) > 0 ? "LONG" : "SHORT",
            size: this.position.positionAmt,
            entryPrice: this.position.entryPrice,
            unrealizedPnl: this.position.unRealizedProfit,
            leverage: this.position.leverage,
            liquidationPrice: this.position.liquidationPrice,
            notional: this.position.notional,
          }
        : null,
      gridLevels: this.gridLevels,
      totalPnl: this.totalPnl,
      filledCount: this.filledCount,
      startTime: this.startTime,
      errors: this.errors.slice(-50),
      perGridProfitUsdt: this.perGridProfitUsdt,
      perGridProfitPercent: this.perGridProfitPercent,
      gridUpperPrice: this.gridUpperPrice,
      gridLowerPrice: this.gridLowerPrice,
      totalMargin,
      liquidationDistance: liqDistance,
      fundingRate: this.fundingRate,
    };
  }
}
