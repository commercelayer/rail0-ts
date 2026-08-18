import type { ApiErrorBody } from '../resources/types.js'
import { throttleDelayMs } from './backoff.js'
import { Rail0ApiError } from './error.js'

/** One log record emitted by the HTTP client per request attempt. */
export interface LogEntry {
  /** HTTP method (GET, POST, …). */
  method: string
  /** Full URL including query string. */
  url: string
  /** Serialised request body, if any. */
  requestBody?: unknown
  /** HTTP status code. Absent on network-level errors. */
  status?: number
  /** Wall-clock time from sending the request to receiving the response, in milliseconds. */
  durationMs: number
  /** Parsed JSON response body. */
  responseBody?: unknown
  /** Network error or `Rail0ApiError` for non-2xx responses. */
  error?: unknown
  /** 1-based attempt number. Present only when `maxRetries > 0`. */
  attempt?: number
  /** `true` when a retry is scheduled after this failed network attempt. */
  willRetry?: boolean
}

/**
 * Pluggable logging callback. Receives one `LogEntry` per request attempt.
 *
 * Pass `debugLogger` for built-in `console.debug` output, or supply your own function
 * to route entries into pino, winston, or any observability pipeline.
 */
export type Logger = (entry: LogEntry) => void

/**
 * Built-in logger that writes a one-line summary to `console.debug`.
 *
 * ```ts
 * const client = new Rail0Client({ baseUrl: '...', logger: debugLogger })
 * ```
 */
export function debugLogger(entry: LogEntry): void {
  const status = entry.status !== undefined ? ` ${entry.status}` : ''
  const flag = entry.error !== undefined ? ' ERROR' : ''
  const attemptInfo =
    entry.attempt !== undefined
      ? ` [attempt ${entry.attempt}${entry.willRetry === true ? ', retrying' : ''}]`
      : ''
  console.debug(
    `[rail0]${flag}${attemptInfo} ${entry.method}${status} ${entry.url} ${entry.durationMs}ms`,
    ...(entry.requestBody !== undefined ? ['→', entry.requestBody] : []),
    ...(entry.responseBody !== undefined ? ['←', entry.responseBody] : []),
    ...(entry.error !== undefined ? ['!', entry.error] : []),
  )
}

/** Constructor options for `HttpClient` (and `Rail0Client`, which re-exports this type). */
export interface HttpClientOptions {
  /** Base URL of the RAIL0 API, e.g. `"https://api.rail0.xyz"`. Trailing slash is stripped. */
  baseUrl: string
  /** Default headers merged into every request. Useful for API keys or correlation IDs. */
  headers?: Record<string, string>
  /** Timeout in milliseconds. Default: 30 000. */
  timeout?: number
  /** Optional logger. Pass `debugLogger` for built-in console output, or a custom function to integrate with pino / winston / etc. */
  logger?: Logger
  /** Number of additional attempts after the first failure. Only network errors and timeouts are retried — HTTP errors are not. Default: 0. */
  maxRetries?: number
  /** Base delay in ms between retries. Doubles with each subsequent attempt (exponential backoff). Default: 200. */
  retryDelay?: number
  /**
   * Retry a rate-limited request (HTTP 429), waiting the gateway's `Retry-After`. Default:
   * **false**.
   *
   * Off by default deliberately: an automatic sleep hides back-pressure from the code that
   * could react to it, and in a browser it turns a rate limit into a frozen click. Turn it
   * on in a job or a worker. `Rail0ApiError.retryAfter` is what to read when it is off.
   *
   * It does NOT need `maxRetries` set as well — that pairing would make this flag a silent
   * no-op — so on its own it allows one retry.
   *
   * A 429 is the only HTTP status this client retries, and the reason is not that it is
   * common: the gateway rejects it in middleware, BEFORE the request reaches the
   * application, so nothing was executed and nothing can run twice. That is not true of a
   * 502 or a timeout on, say, a capture, where the broadcast may already be in flight —
   * which is why those are never retried, whatever the method.
   */
  retryOn429?: boolean
  /**
   * Longest `Retry-After` to honour, in ms. Default: 60 000.
   *
   * A gateway older than rail0-gateway#201 sends its whole throttle period rather than the
   * time left in the window, so this bounds both that over-wait and any hostile value from
   * in between.
   */
  retryAfterCapMs?: number
  /**
   * Cancels the request — and, when a retry is waiting, the wait as well.
   *
   * The client had no caller-side cancellation at all: the only AbortController was the
   * internal per-attempt timeout. That was survivable while nothing slept for long, and
   * stops being survivable with `retryOn429`, which can hold a promise for a minute.
   */
  signal?: AbortSignal
}

/**
 * Sleep, unless the caller cancels first.
 *
 * Rejects with the signal's reason on abort rather than resolving early, so a cancelled
 * wait cancels the request instead of retrying it a moment later. Listener removed on
 * both paths: a long-lived client that retried often would otherwise accumulate one per
 * wait on a signal the caller keeps.
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(signal.reason)
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(signal?.reason)
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/**
 * Parse the `Retry-After` header into a number of seconds. The gateway's rate
 * limiter advertises the throttle window as an integer count of seconds (never an
 * HTTP-date), so we only accept the delta-seconds form; anything else yields
 * undefined. Only meaningful on a 429 response, but harmless elsewhere.
 */
function retryAfterSeconds(response: Response): number | undefined {
  const raw = response.headers.get('Retry-After')
  if (raw == null) return undefined
  const n = Number(raw)
  return Number.isFinite(n) ? n : undefined
}

export class HttpClient {
  private readonly baseUrl: string
  private readonly headers: Record<string, string>
  private readonly timeout: number
  private readonly logger: Logger | undefined
  private readonly maxRetries: number
  private readonly retryDelay: number
  private readonly retryOn429: boolean
  private readonly retryAfterCapMs: number
  private readonly signal: AbortSignal | undefined

  constructor(options: HttpClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '')
    this.headers = { 'Content-Type': 'application/json', ...options.headers }
    this.timeout = options.timeout ?? 30_000
    this.logger = options.logger
    this.maxRetries = options.maxRetries ?? 0
    this.retryDelay = options.retryDelay ?? 200
    this.retryOn429 = options.retryOn429 ?? false
    this.retryAfterCapMs = options.retryAfterCapMs ?? 60_000
    this.signal = options.signal
  }

  /**
   * Set (or clear) the Bearer token sent on every subsequent request. Pass a JWT
   * to authenticate a long-lived client after `auth.login()`; pass null/undefined
   * to clear it. Additive — a token may still be supplied at construction via
   * `headers`.
   */
  setAuthToken(token: string | null | undefined): void {
    if (token) this.headers.Authorization = `Bearer ${token}`
    else delete this.headers.Authorization
  }

  async get<T>(path: string): Promise<T> {
    return (await this.send<T>('GET', path)).data
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    return (await this.send<T>('PUT', path, body)).data
  }

  async post<T>(path: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    return (await this.send<T>('POST', path, body, headers)).data
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    return (await this.send<T>('PATCH', path, body)).data
  }

  async delete<T = void>(path: string): Promise<T> {
    return (await this.send<T>('DELETE', path)).data
  }

  /**
   * GET a list endpoint into a `{ data, meta }` envelope. The gateway returns a
   * bare JSON array and carries pagination in the `x-total-count` / `x-page` /
   * `x-per-page` response headers, which we fold into `meta` (matching rail0-go).
   */
  async getPaginated<T>(
    path: string,
  ): Promise<{ data: T[]; meta: { page: number; per_page: number; total: number } }> {
    const { data, headers } = await this.send<T[]>('GET', path)
    const arr = Array.isArray(data) ? data : []
    const num = (name: string, fallback: number): number => {
      const raw = headers.get(name)
      const n = raw == null ? Number.NaN : Number(raw)
      return Number.isFinite(n) ? n : fallback
    }
    return {
      data: arr,
      meta: {
        page: num('x-page', 1),
        per_page: num('x-per-page', arr.length),
        total: num('x-total-count', arr.length),
      },
    }
  }

  private async send<T>(
    method: string,
    path: string,
    body?: unknown,
    extraHeaders?: Record<string, string>,
  ): Promise<{ data: T; headers: Headers }> {
    const url = `${this.baseUrl}${path}`
    // A retry budget of at least 1 when retryOn429 is on, so the flag works on its own:
    // requiring maxRetries as well would have made it a silent no-op.
    const retryBudget = this.retryOn429 ? Math.max(this.maxRetries, 1) : this.maxRetries
    const maxAttempts = retryBudget + 1
    const trackAttempts = retryBudget > 0
    // Set when a 429 asked for a specific wait; -1 means "use the exponential backoff".
    // Carried across iterations rather than computed at the top, because only the response
    // knows what the server asked for.
    let waitMs = -1

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (attempt > 1) {
        await sleep(waitMs >= 0 ? waitMs : this.retryDelay * 2 ** (attempt - 2), this.signal)
        waitMs = -1
      }

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), this.timeout)
      // The caller's cancellation and the per-attempt timeout are separate reasons to give
      // up, and fetch takes one signal — so the caller's is forwarded onto the internal
      // controller.
      const onCallerAbort = () => controller.abort(this.signal?.reason)
      this.signal?.addEventListener('abort', onCallerAbort, { once: true })
      if (this.signal?.aborted) controller.abort(this.signal.reason)
      const start = Date.now()

      let response: Response
      try {
        response = await fetch(url, {
          method,
          headers: extraHeaders ? { ...this.headers, ...extraHeaders } : this.headers,
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
          signal: controller.signal,
        })
      } catch (err) {
        clearTimeout(timer)
        this.signal?.removeEventListener('abort', onCallerAbort)
        // A caller who cancelled does not want another attempt.
        const willRetry = attempt < maxAttempts && this.signal?.aborted !== true
        this.logger?.({
          method,
          url,
          requestBody: body,
          durationMs: Date.now() - start,
          error: err,
          ...(trackAttempts ? { attempt, willRetry } : {}),
        })
        if (willRetry) continue
        throw err
      }
      clearTimeout(timer)
      this.signal?.removeEventListener('abort', onCallerAbort)

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => ({
          status: 'unknown_error',
          message: `HTTP ${response.status}`,
        }))) as ApiErrorBody
        const retryAfter = retryAfterSeconds(response)
        const apiError = new Rail0ApiError(response.status, errorBody, retryAfter)
        // The one retryable status — see retryOn429 for why a POST is as safe as a GET.
        const willRetry =
          response.status === 429 &&
          this.retryOn429 &&
          attempt < maxAttempts &&
          this.signal?.aborted !== true
        this.logger?.({
          method,
          url,
          requestBody: body,
          status: response.status,
          durationMs: Date.now() - start,
          responseBody: errorBody,
          error: apiError,
          ...(trackAttempts ? { attempt, willRetry } : {}),
        })
        if (willRetry) {
          waitMs = throttleDelayMs({
            retryAfterSeconds: retryAfter,
            attempt,
            baseMs: this.retryDelay,
            capMs: this.retryAfterCapMs,
          })
          continue
        }
        throw apiError
      }

      // 204 (and other empty bodies, e.g. DELETE) parse to `undefined` rather
      // than throwing on an empty JSON body.
      const text = await response.text()
      const data = (text ? JSON.parse(text) : undefined) as T
      this.logger?.({
        method,
        url,
        requestBody: body,
        status: response.status,
        durationMs: Date.now() - start,
        responseBody: data,
        ...(trackAttempts ? { attempt } : {}),
      })
      return { data, headers: response.headers }
    }

    // maxAttempts >= 1, so the loop always executes at least once and either
    // returns or throws. This line satisfies the TypeScript control-flow checker.
    throw new Error('unreachable')
  }
}
