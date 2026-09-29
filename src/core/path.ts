/**
 * A request path whose interpolated values are each ONE encoded segment.
 *
 *   path`/payments/${id}/transactions/${transactionId}`
 *
 * Every resource built its paths as plain template literals, so an id was pasted in raw:
 * one containing `/`, `..`, `?` or `#` addressed a different route than the method named —
 * `payments.get('../webhooks/x')` is a GET on /webhooks/x with the caller's token. The ids
 * this SDK is handed normally come from the gateway, but a caller that forwards one from
 * a URL (a proxy route, a CLI argument) passes along whatever it was given. Encoding each
 * value with encodeURIComponent keeps it inside its segment; for the values that are
 * legitimately used (0x hex, UUIDs, operation names) it changes nothing.
 *
 * A value that is empty, `.` or `..` is REFUSED with a TypeError instead of encoded:
 * encodeURIComponent leaves dots alone, so `..` would still be a dot segment that a proxy
 * or router may resolve away, and an empty id silently turns `payments.get('')` into the
 * list route. rail0-go and rail0-ruby refuse the same three values, so the SDKs agree.
 * The throw is synchronous, before any request is made.
 *
 * Query strings are NOT built here: they come from buildQuery, which encodes its own
 * values, and are appended to the result.
 */
export function path(strings: TemplateStringsArray, ...values: (string | number)[]): string {
  return strings.reduce((out, s, i) => {
    if (i >= values.length) return out + s
    const value = String(values[i])
    if (value === '' || value === '.' || value === '..') {
      throw new TypeError(
        `invalid path segment ${JSON.stringify(value)}: an id cannot be empty, "." or ".."`,
      )
    }
    return out + s + encodeURIComponent(value)
  }, '')
}
