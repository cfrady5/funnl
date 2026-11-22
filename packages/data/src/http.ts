import { createHash } from 'node:crypto';

export class ProviderError extends Error {
  constructor(
    public provider: string,
    public status: number | null,
    message: string,
    public retryable: boolean,
  ) {
    super(`[${provider}] ${message}`);
    this.name = 'ProviderError';
  }
}

/** 401/403: missing key OR the subscription tier does not include the endpoint. */
export class ProviderAccessError extends ProviderError {
  constructor(provider: string, status: number, endpoint: string) {
    super(provider, status, `${status} for ${endpoint}: missing/invalid API key, or your plan does not include this endpoint`, false);
    this.name = 'ProviderAccessError';
  }
}

export interface ArchivedRequest {
  provider: string;
  /** Host actually called — distinguishes the real API from a local mock. */
  host: string;
  endpoint: string;
  params: Record<string, unknown>;
  httpStatus: number | null;
  ok: boolean;
  durationMs: number;
  payload: unknown;
  payloadSha256: string | null;
  error: string | null;
  retrievedAt: string;
}

export interface HttpClientOptions {
  provider: string;
  baseUrl: string;
  headers: () => Record<string, string>;
  requestsPerMinute: number;
  maxRetries?: number;
  timeoutMs?: number;
  onArchive?: (r: ArchivedRequest) => void | Promise<void>;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

/** Token-bucket limiter: spreads requests evenly within the provider's per-minute budget. */
class RateLimiter {
  private next = 0;
  constructor(private perMinute: number, private sleep: (ms: number) => Promise<void>) {}
  async take(): Promise<void> {
    const interval = 60_000 / Math.max(1, this.perMinute);
    const now = Date.now();
    const at = Math.max(now, this.next);
    this.next = at + interval;
    if (at > now) await this.sleep(at - now);
  }
}

/** Query string with repeated array params, e.g. dates[]=2026-11-21&game_ids[]=1. */
export function buildQuery(params: Record<string, string | number | boolean | Array<string | number> | undefined | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) v.forEach((x) => q.append(k, String(x)));
    else q.append(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

export class ProviderHttpClient {
  private limiter: RateLimiter;
  private fetchImpl: typeof fetch;
  private sleep: (ms: number) => Promise<void>;
  constructor(private o: HttpClientOptions) {
    this.sleep = o.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.limiter = new RateLimiter(o.requestsPerMinute, this.sleep);
    this.fetchImpl = o.fetchImpl ?? fetch;
  }

  async getJson<T>(endpoint: string, params: Record<string, string | number | boolean | Array<string | number> | undefined | null> = {}): Promise<T> {
    const url = `${this.o.baseUrl.replace(/\/$/, '')}${endpoint}${buildQuery(params)}`;
    const maxRetries = this.o.maxRetries ?? 4;
    let attempt = 0;
    for (;;) {
      attempt++;
      await this.limiter.take();
      const started = Date.now();
      let status: number | null = null;
      try {
        const res = await this.fetchImpl(url, { headers: { accept: 'application/json', ...this.o.headers() }, signal: AbortSignal.timeout(this.o.timeoutMs ?? 30_000) });
        status = res.status;
        const text = await res.text();
        let body: unknown = null;
        try {
          body = text ? JSON.parse(text) : null;
        } catch {
          body = { nonJson: text.slice(0, 500) };
        }
        await this.archive(endpoint, params, status, res.ok, started, res.ok ? body : null, res.ok ? null : text.slice(0, 500));
        if (res.ok) return body as T;
        if (status === 401 || status === 403) throw new ProviderAccessError(this.o.provider, status, endpoint);
        if (status === 404) throw new ProviderError(this.o.provider, status, `404 for ${endpoint}`, false);
        const retryable = status === 429 || status >= 500;
        if (!retryable || attempt > maxRetries) throw new ProviderError(this.o.provider, status, `${status} for ${endpoint}: ${text.slice(0, 200)}`, retryable);
        const retryAfter = Number(res.headers.get('retry-after'));
        await this.sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : Math.min(60_000, 1000 * 2 ** attempt));
      } catch (e) {
        if (e instanceof ProviderError) throw e;
        await this.archive(endpoint, params, status, false, started, null, (e as Error).message);
        if (attempt > maxRetries) throw new ProviderError(this.o.provider, status, `network error for ${endpoint}: ${(e as Error).message}`, true);
        await this.sleep(Math.min(60_000, 1000 * 2 ** attempt));
      }
    }
  }

  private async archive(endpoint: string, params: Record<string, unknown>, httpStatus: number | null, ok: boolean, started: number, payload: unknown, error: string | null) {
    if (!this.o.onArchive) return;
    const json = payload == null ? null : JSON.stringify(payload);
    await this.o.onArchive({
      provider: this.o.provider,
      host: new URL(this.o.baseUrl).host,
      endpoint,
      params,
      httpStatus,
      ok,
      durationMs: Date.now() - started,
      payload,
      payloadSha256: json ? createHash('sha256').update(json).digest('hex') : null,
      error,
      retrievedAt: new Date().toISOString(),
    });
  }
}
