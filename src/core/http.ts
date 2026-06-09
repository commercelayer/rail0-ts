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
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export class HttpClient {
  private readonly baseUrl: string
  private readonly headers: Record<string, string>
  private readonly timeout: number
  private readonly logger: Logger | undefined
  private readonly maxRetries: number
  private readonly retryDelay: number

  constructor(options: HttpClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '')
    this.headers = { 'Content-Type': 'application/json', ...options.headers }
    this.timeout = options.timeout ?? 30_000
    this.logger = options.logger
    this.maxRetries = options.maxRetries ?? 0
    this.retryDelay = options.retryDelay ?? 200
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path)
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, body)
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body)
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body)
  }

  async delete<T = void>(path: string): Promise<T> {
    return this.request<T>('DELETE', path)
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const maxAttempts = this.maxRetries + 1
    const trackAttempts = this.maxRetries > 0

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (attempt > 1) {
        await sleep(this.retryDelay * 2 ** (attempt - 2))
      }

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), this.timeout)
      const start = Date.now()

      let response: Response
      try {
        response = await fetch(url, {
          method,
          headers: this.headers,
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
          signal: controller.signal,
        })
      } catch (err) {
        clearTimeout(timer)
        const willRetry = attempt < maxAttempts
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

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => ({
          error: 'UnknownError',
          message: `HTTP ${response.status}`,
        }))) as { error: string; message: string }
        const apiError = new Rail0ApiError(response.status, errorBody)
        this.logger?.({
          method,
          url,
          requestBody: body,
          status: response.status,
          durationMs: Date.now() - start,
          responseBody: errorBody,
          error: apiError,
          ...(trackAttempts ? { attempt } : {}),
        })
        throw apiError
      }

      const data = (await response.json()) as T
      this.logger?.({
        method,
        url,
        requestBody: body,
        status: response.status,
        durationMs: Date.now() - start,
        responseBody: data,
        ...(trackAttempts ? { attempt } : {}),
      })
      return data
    }

    // maxAttempts >= 1, so the loop always executes at least once and either
    // returns or throws. This line satisfies the TypeScript control-flow checker.
    throw new Error('unreachable')
  }
}
