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
 * Query strings are NOT built here: they come from buildQuery, which encodes its own
 * values, and are appended to the result.
 */
export function path(strings: TemplateStringsArray, ...values: (string | number)[]): string {
  return strings.reduce(
    (out, s, i) => out + s + (i < values.length ? encodeURIComponent(String(values[i])) : ''),
    '',
  )
}
