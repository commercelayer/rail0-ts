/**
 * Dispute flow (payer-driven, signal-only): open → close.
 *
 * A dispute is an on-chain signal the payer raises against a payment (e.g. goods
 * not delivered). It does not move funds by itself — it flags the payment as
 * disputed. The payer can later close it. Both steps are prepare → sign → submit,
 * signed by the payer.
 *
 * Every step is the buyer's (payer's), so only the buyer's client is needed — logged
 * in with the buyer key (an account-less session), since every /payments route
 * requires one and dispute/close are payer-only.
 */

import { Rail0ApiError, Rail0Client, signTransaction } from '../src/index.js'

const buyer = new Rail0Client({ baseUrl: 'https://api.rail0.xyz' })

const BUYER_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const id = '0xdeadbeef00000000000000000000000000000000000000000000000000000004'

try {
  await buyer.auth.login(BUYER_KEY, 'api.rail0.xyz')

  // Open a dispute. `reason` is an optional bytes32 code.
  const openPrep = await buyer.payments.disputePrepare(id, `0x${'11'.repeat(32)}`)
  await buyer.payments.dispute(id, {
    signed_transaction: signTransaction(openPrep.unsigned_transaction as string, BUYER_KEY),
  })
  console.log('Dispute opened')

  // …later, the payer closes it.
  const closePrep = await buyer.payments.closeDisputePrepare(id)
  await buyer.payments.closeDispute(id, {
    signed_transaction: signTransaction(closePrep.unsigned_transaction as string, BUYER_KEY),
  })
  console.log('Dispute closed')

  // Inspect the dispute history (paginated).
  const history = await buyer.payments.disputes(id)
  for (const d of history.data) console.log(d.status, d.opened_at, d.closed_at)
} catch (err) {
  if (err instanceof Rail0ApiError) console.error(`[${err.code}] ${err.message}`)
  throw err
}
