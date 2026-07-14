/**
 * Dispute flow (payer-driven, signal-only): open → close.
 *
 * A dispute is an on-chain signal the payer raises against a payment (e.g. goods
 * not delivered). It does not move funds by itself — it flags the payment as
 * disputed. The payer can later close it. Both steps are prepare → sign → submit,
 * signed by the payer.
 */

import { Rail0ApiError, Rail0Client, signTransaction } from '../src/index.js'

const client = new Rail0Client({ baseUrl: 'https://api.rail0.xyz' })

const PAYER_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const id = '0xdeadbeef00000000000000000000000000000000000000000000000000000004'

try {
  // Open a dispute. `reason` is an optional bytes32 code.
  const openPrep = await client.payments.disputePrepare(id, `0x${'11'.repeat(32)}`)
  await client.payments.dispute(id, {
    signed_transaction: signTransaction(openPrep.unsigned_transaction as string, PAYER_KEY),
  })
  console.log('Dispute opened')

  // …later, the payer closes it.
  const closePrep = await client.payments.closeDisputePrepare(id)
  await client.payments.closeDispute(id, {
    signed_transaction: signTransaction(closePrep.unsigned_transaction as string, PAYER_KEY),
  })
  console.log('Dispute closed')

  // Inspect the dispute history (paginated).
  const history = await client.payments.disputes(id)
  for (const d of history.data) console.log(d.status, d.opened_at, d.closed_at)
} catch (err) {
  if (err instanceof Rail0ApiError) console.error(`[${err.error}] ${err.message}`)
  throw err
}
