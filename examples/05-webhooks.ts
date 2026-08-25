/**
 * Webhooks — subscribe to payment lifecycle events.
 *
 * The gateway POSTs to your callback URL when a payment transitions (authorized,
 * captured, refunded, …), signed with an HMAC-SHA256 over `"{timestamp}.{body}"` using
 * the shared secret returned at creation — carried in X-Rail0-Signature alongside
 * X-Rail0-Timestamp. One topic per webhook — create several to cover multiple events.
 * All calls require a JWT.
 *
 * (This comment used to say the digest covered the raw body alone. It has not since
 * rail0-gateway#174 put the timestamp inside the signed string, which is what bounds a
 * replay — and a consumer who implemented the old description would reject every live
 * delivery.)
 */

import { Rail0ApiError, Rail0Client, verifyWebhookSignature } from '../src/index.js'

// Authenticate first (or pass a token you already hold via `headers`).
const client = new Rail0Client({
  baseUrl: 'https://api.rail0.xyz',
  headers: { Authorization: 'Bearer <your-jwt>' },
})

try {
  // Register a webhook — the shared_secret is returned ONLY here (and on rotate).
  // One subscription for every event this endpoint cares about: one shared secret to
  // verify against and one circuit breaker, rather than one of each per topic.
  const created = await client.webhooks.create({
    name: 'order-lifecycle',
    callback_url: 'https://merchant.example.com/rail0/webhooks',
    topics: ['payments.authorized', 'payments.captured', 'payments.voided', 'payments.refunded'],
  })
  console.log('Webhook id:', created.id, '— store this secret:', created.shared_secret)

  // List webhooks (paginated).
  const { data } = await client.webhooks.list({ active: true })
  console.log('Active webhooks:', data.length)

  // Inspect recent delivery attempts.
  const callbacks = await client.webhooks.eventCallbacks(created.id as string, { status: 'failed' })
  console.log('Failed deliveries:', callbacks.meta.total)

  // Verifying a delivery in your own handler. The body must be the RAW bytes as
  // received: re-serialising a parsed object changes key order and whitespace, and the
  // digest with it. The timestamp is checked too — a matching digest on a three-day-old
  // delivery is a replay, not an event.
  const authentic = verifyWebhookSignature({
    body: '{"id":"evt_1","topic":"payments.captured"}', // await request.text()
    signature: '<X-Rail0-Signature>',
    timestamp: '<X-Rail0-Timestamp>',
    secret: created.shared_secret as string,
  })
  console.log('Delivery authentic:', authentic) // false here — the values are placeholders

  // Rotate the secret, or clean up.
  // await client.webhooks.rotateSecret(created.id as string)
  await client.webhooks.delete(created.id as string)
} catch (err) {
  if (err instanceof Rail0ApiError) console.error(`[${err.error}] ${err.message}`)
  throw err
}
