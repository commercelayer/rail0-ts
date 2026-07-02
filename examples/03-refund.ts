/**
 * Refund flow — two-phase EIP-3009 (payee signs a ReceiveWithAuthorization).
 *
 *   phase 1: refundPrepare({ amount })      → a tx carrying the signing payload
 *   payee signs that payload (signRefund)
 *   phase 2: refundPrepare({ amount, v,r,s }) → the unsigned on-chain refund tx
 *   payee signs + submits the tx (refund)
 *
 * Refunds are only possible while within the refund window and up to the
 * payment's refundable_amount.
 */

import { Rail0ApiError, Rail0Client, signRefund, signTransaction } from '../src/index.js'

const client = new Rail0Client({ baseUrl: 'https://api.rail0.xyz' })

const PAYEE_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'
const id = '0xdeadbeef00000000000000000000000000000000000000000000000000000002'

try {
  // Check how much is refundable before acting.
  const detail = await client.payments.get(id)
  console.log('Refundable:', detail.refundable_amount)

  // Phase 1 — get the ReceiveWithAuthorization payload for the payee to sign.
  const phase1 = await client.payments.refundPrepare(id, { amount: '50000000' })
  const sig = signRefund(PAYEE_KEY, phase1)

  // Phase 2 — hand the signature back to get the unsigned on-chain refund tx.
  const phase2 = await client.payments.refundPrepare(id, {
    amount: '50000000',
    signature: `${sig.r}${sig.s.slice(2)}${sig.v.toString(16).padStart(2, '0')}`,
  })

  // Sign + submit the refund transaction.
  const tx = await client.payments.refund(id, {
    signed_transaction: signTransaction(phase2.unsigned_transaction as string, PAYEE_KEY),
  })
  console.log('Refund submitted:', tx.status)
} catch (err) {
  if (err instanceof Rail0ApiError) console.error(`[${err.error}] ${err.message}`)
  throw err
}
