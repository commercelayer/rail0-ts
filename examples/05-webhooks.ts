/**
 * Webhooks — subscribe to payment lifecycle events.
 *
 * The gateway POSTs to your callback URL when a payment transitions (authorized,
 * captured, refunded, …), signed with an HMAC-SHA256 over the raw body using the
 * shared secret returned at creation (X-Rail0-Signature header). One topic per
 * webhook — create several to cover multiple events. All calls require a JWT.
 */

import { Rail0ApiError, Rail0Client } from '../src/index.js'

// Authenticate first (or pass a token you already hold via `headers`).
const client = new Rail0Client({
  baseUrl: 'https://api.rail0.xyz',
  headers: { Authorization: 'Bearer <your-jwt>' },
})

try {
  // Register a webhook — the shared_secret is returned ONLY here (and on rotate).
  const created = await client.webhooks.create({
    name: 'capture-notifier',
    callback_url: 'https://merchant.example.com/rail0/webhooks',
    topic: 'payments.captured',
  })
  console.log('Webhook id:', created.id, '— store this secret:', created.shared_secret)

  // List webhooks (paginated).
  const { data } = await client.webhooks.list({ active: true })
  console.log('Active webhooks:', data.length)

  // Inspect recent delivery attempts.
  const callbacks = await client.webhooks.eventCallbacks(created.id as string, { status: 'failed' })
  console.log('Failed deliveries:', callbacks.meta.total)

  // Rotate the secret, or clean up.
  // await client.webhooks.rotateSecret(created.id as string)
  await client.webhooks.delete(created.id as string)
} catch (err) {
  if (err instanceof Rail0ApiError) console.error(`[${err.error}] ${err.message}`)
  throw err
}
