/**
 * How long to wait before retrying a request the gateway rate-limited.
 *
 * Pure and exported so it can be tested, because two of its decisions are easy to get
 * backwards and impossible to notice once they are wrong — a client that waits too little
 * walks straight back into the limiter, and one that waits too long looks hung.
 *
 * 1. JITTER IS ADDITIVE ON A SERVER-INSTRUCTED WAIT, MULTIPLICATIVE ON A GUESS.
 *    Textbook "full jitter" multiplies the delay by random(), which is right for a backoff
 *    we invented — it spreads a thundering herd — and wrong for a Retry-After: scaling the
 *    server's own number DOWN means retrying before the window it named has passed, which
 *    is a second 429 by construction. So an instructed wait is honoured in full and a small
 *    random tail is ADDED; a guessed one is jittered the usual way.
 *
 *    Why jitter at all when the server named the time: because callers align on it.
 *    rail0-admin proxies every merchant over ONE session, so they share the per-session
 *    bucket, are told the same Retry-After, and would wake together — recreating the burst
 *    the limiter just rejected.
 *
 * 2. THE CAP IS NOT PARANOIA. A gateway older than rail0-gateway#201 sends the WHOLE
 *    throttle period as Retry-After rather than the time remaining in the window, so a
 *    limit hit one second in asks for the full 60. The cap bounds that over-wait and any
 *    hostile or misconfigured value from anything between the client and the gateway.
 *
 * Mirrors Rail0::Backoff in rail0-ruby: same rules, same names, so the three SDKs behave
 * the same against the same server.
 */
export interface ThrottleDelayArgs {
  /**
   * The server's `Retry-After`, in SECONDS. Absent, zero or negative all mean "no
   * instruction" — and zero is the trap: it is a valid duration, so treating it as one
   * produces a burst of back-to-back requests against the limiter that asked for a pause.
   */
  retryAfterSeconds?: number | undefined
  /** 1 for the first retry, 2 for the second, … */
  attempt: number
  /** The exponential backoff's first delay, in ms. */
  baseMs: number
  /** The longest wait to allow, in ms. */
  capMs: number
  /** Randomness in [0,1); injected by tests. Omit to draw it. */
  jitter?: number | undefined
}

export function throttleDelayMs(args: ThrottleDelayArgs): number {
  const { retryAfterSeconds, attempt, baseMs, capMs } = args
  const random = args.jitter ?? Math.random()
  const instructed =
    typeof retryAfterSeconds === 'number' &&
    Number.isFinite(retryAfterSeconds) &&
    retryAfterSeconds > 0
      ? retryAfterSeconds * 1000
      : undefined

  if (instructed !== undefined) {
    // Honoured in full (clamped), plus a fraction of one base delay so aligned callers do
    // not wake in lockstep.
    return Math.min(instructed, capMs) + random * baseMs
  }
  return Math.min(baseMs * 2 ** (attempt - 1) * random, capMs)
}
