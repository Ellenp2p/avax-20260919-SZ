import { createHmac } from "crypto";

export interface PrimitConfig {
  apiKey: string;
  apiSecret: string;
  baseUrl: string;
  wsUrl: string;
}

export const TESTNET: PrimitConfig = {
  apiKey: process.env.PRIMIT_API_KEY || "",
  apiSecret: process.env.PRIMIT_API_SECRET || "",
  baseUrl: "https://api.primit.xyz",
  wsUrl: "wss://api.primit.xyz/ws",
};

export const MAINNET: PrimitConfig = {
  apiKey: process.env.PRIMIT_API_KEY || "",
  apiSecret: process.env.PRIMIT_API_SECRET || "",
  baseUrl: "https://api.primit.io",
  wsUrl: "wss://api.primit.io/ws",
};

function sign(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export interface OrderParams {
  symbol: string;
  side: "BUY" | "SELL";
  type: "LIMIT" | "MARKET";
  quantity: string;
  price?: string;
  timeInForce?: "GTC" | "IOC" | "FOK" | "GTX";
  reduceOnly?: boolean;
  newClientOrderId?: string;
}

export interface PositionInfo {
  symbol: string;
  positionAmt: string;
  entryPrice: string;
  markPrice: string;
  unRealizedProfit: string;
  leverage: string;
  liquidationPrice: string;
  notional: string;
  positionSide: string;
  updateTime: number;
}

export interface ExchangeInfo {
  symbols: Array<{
    symbol: string;
    pair: string;
    contractType: string;
    status: string;
    baseAsset: string;
    quoteAsset: string;
    pricePrecision: number;
    quantityPrecision: number;
    filters: Array<{
      filterType: string;
      minQty?: string;
      maxQty?: string;
      stepSize?: string;
      tickSize?: string;
      minPrice?: string;
      maxPrice?: string;
      notional?: string;
    }>;
  }>;
}

export interface Ticker {
  symbol: string;
  last_price: string;
  mark_price: string;
  index_price: string;
  price_change_24h: string;
  price_change_percent_24h: string;
  high_24h: string;
  low_24h: string;
  volume_24h: string;
}

export interface OpenOrder {
  orderId: number;
  clientOrderId: string;
  symbol: string;
  side: string;
  type: string;
  price: string;
  origQty: string;
  executedQty: string;
  status: string;
  timeInForce: string;
  time: number;
}

export class PrimitClient {
  private config: PrimitConfig;
  private listenKey: string | null = null;
  private ws: WebSocket | null = null;
  private wsCallbacks: Map<string, (data: any) => void> = new Map();
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: PrimitConfig) {
    this.config = config;
  }

  private timestamp(): number {
    return Date.now();
  }

  private signedQuery(params: Record<string, string | number>): string {
    params.timestamp = this.timestamp();
    const qs = Object.entries(params)
      .map(([k, v]) => `${k}=${v}`)
      .join("&");
    const signature = sign(this.config.apiSecret, qs);
    return `${qs}&signature=${signature}`;
  }

  private signedPost(body: Record<string, any>): {
    queryString: string;
    bodyStr: string;
  } {
    const ts = this.timestamp();
    const bodyStr = JSON.stringify(body);
    const payload = `timestamp=${ts}${bodyStr}`;
    const signature = sign(this.config.apiSecret, payload);
    return {
      queryString: `timestamp=${ts}&signature=${signature}`,
      bodyStr,
    };
  }

  async get<T>(path: string, params: Record<string, any> = {}): Promise<T> {
    params.timestamp = this.timestamp();
    const qs = Object.entries(params)
      .map(([k, v]) => `${k}=${v}`)
      .join("&");
    const signature = sign(this.config.apiSecret, qs);
    const url = `${this.config.baseUrl}${path}?${qs}&signature=${signature}`;
    const res = await fetch(url, {
      headers: { "X-MBX-APIKEY": this.config.apiKey },
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`GET ${path} failed: ${res.status} ${err}`);
    }
    return res.json() as Promise<T>;
  }

  async post<T>(path: string, body: Record<string, any>): Promise<T> {
    const { queryString, bodyStr } = this.signedPost(body);
    const url = `${this.config.baseUrl}${path}?${queryString}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "X-MBX-APIKEY": this.config.apiKey,
        "Content-Type": "application/json",
      },
      body: bodyStr,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`POST ${path} failed: ${res.status} ${err}`);
    }
    return res.json() as Promise<T>;
  }

  async delete<T>(path: string, params: Record<string, any> = {}): Promise<T> {
    params.timestamp = this.timestamp();
    const qs = Object.entries(params)
      .map(([k, v]) => `${k}=${v}`)
      .join("&");
    const signature = sign(this.config.apiSecret, qs);
    const url = `${this.config.baseUrl}${path}?${qs}&signature=${signature}`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: { "X-MBX-APIKEY": this.config.apiKey },
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`DELETE ${path} failed: ${res.status} ${err}`);
    }
    return res.json() as Promise<T>;
  }

  async exchangeInfo(): Promise<ExchangeInfo> {
    return this.get<ExchangeInfo>("/fapi/v1/exchangeInfo");
  }

  async ticker(symbol: string): Promise<Ticker> {
    return this.get<Ticker>("/fapi/v1/ticker/24hr", { symbol });
  }

  async getPositions(symbol?: string): Promise<PositionInfo[]> {
    const params: Record<string, any> = {};
    if (symbol) params.symbol = symbol;
    return this.get<PositionInfo[]>("/fapi/v1/positionRisk", params);
  }

  async getOpenOrders(symbol?: string): Promise<OpenOrder[]> {
    const params: Record<string, any> = {};
    if (symbol) params.symbol = symbol;
    return this.get<OpenOrder[]>("/fapi/v1/openOrders", params);
  }

  async newOrder(order: OrderParams): Promise<any> {
    const body: Record<string, any> = {
      symbol: order.symbol,
      side: order.side,
      type: order.type,
      quantity: order.quantity,
    };
    if (order.price) body.price = order.price;
    if (order.timeInForce) body.timeInForce = order.timeInForce;
    if (order.reduceOnly !== undefined) body.reduceOnly = String(order.reduceOnly);
    if (order.newClientOrderId) body.newClientOrderId = order.newClientOrderId;
    return this.post("/fapi/v1/order", body);
  }

  async batchNewOrders(orders: OrderParams[]): Promise<any> {
    const orderList = orders.map((o) => {
      const body: Record<string, any> = {
        symbol: o.symbol,
        side: o.side,
        type: o.type,
        quantity: o.quantity,
      };
      if (o.price) body.price = o.price;
      if (o.timeInForce) body.timeInForce = o.timeInForce;
      if (o.reduceOnly !== undefined) body.reduceOnly = String(o.reduceOnly);
      if (o.newClientOrderId) body.newClientOrderId = o.newClientOrderId;
      return body;
    });
    return this.post("/fapi/v1/batchOrders", { orders: JSON.stringify(orderList) });
  }

  async cancelOrder(symbol: string, orderId: number): Promise<any> {
    return this.delete("/fapi/v1/order", { symbol, orderId });
  }

  async cancelAllOrders(symbol: string): Promise<any> {
    return this.delete("/fapi/v1/allOpenOrders", { symbol });
  }

  async changeLeverage(symbol: string, leverage: number): Promise<any> {
    return this.post("/fapi/v1/leverage", { symbol, leverage });
  }

  async createListenKey(): Promise<string> {
    const res = await fetch(`${this.config.baseUrl}/fapi/v1/listenKey`, {
      method: "POST",
      headers: { "X-MBX-APIKEY": this.config.apiKey },
    });
    const data = (await res.json()) as { listenKey: string };
    this.listenKey = data.listenKey;
    return data.listenKey;
  }

  async keepAliveListenKey(): Promise<void> {
    if (!this.listenKey) return;
    await fetch(`${this.config.baseUrl}/fapi/v1/listenKey`, {
      method: "PUT",
      headers: { "X-MBX-APIKEY": this.config.apiKey },
    });
  }

  connectWebSocket(
    onMessage: (data: any) => void,
    channels: string[] = []
  ): void {
    this.ws = new WebSocket(this.config.wsUrl);

    this.ws.onopen = async () => {
      console.log("[WS] Connected to Primit");
      if (this.listenKey) {
        this.ws!.send(JSON.stringify({ type: "auth", listenKey: this.listenKey }));
      }
      for (const ch of channels) {
        this.ws!.send(JSON.stringify({ type: "subscribe", channel: ch }));
      }
    };

    this.ws.onmessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data as string);
      onMessage(data);
      const cb = this.wsCallbacks.get(data.type);
      if (cb) cb(data);
    };

    this.ws.onclose = () => {
      console.log("[WS] Disconnected, reconnecting in 3s...");
      setTimeout(() => this.connectWebSocket(onMessage, channels), 3000);
    };

    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "ping" }));
      }
    }, 25000);
  }

  on(event: string, callback: (data: any) => void): void {
    this.wsCallbacks.set(event, callback);
  }

  disconnectWebSocket(): void {
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.ws) this.ws.close();
  }
}
