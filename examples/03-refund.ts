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
 *
 * Every step is the merchant's (payee's), so only the merchant's client is needed —
 * logged in with the merchant key, since every /payments route requires a session.
 * (The payment itself was created from the buyer's session, as in 01/02.)
 */

import {
  packSignature,
  Rail0ApiError,
  Rail0Client,
  signRefund,
  signTransaction,
} from '../src/index.js'

const merchant = new Rail0Client({ baseUrl: 'https://api.rail0.xyz' })

const MERCHANT_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'
const id = '0xdeadbeef00000000000000000000000000000000000000000000000000000002'

try {
  await merchant.auth.login(MERCHANT_KEY, 'api.rail0.xyz')

  // Check how much is refundable before acting.
  const detail = await merchant.payments.get(id)
  console.log('Refundable:', detail.refundable_amount)

  // Phase 1 — get the ReceiveWithAuthorization payload for the payee to sign.
  const phase1 = await merchant.payments.refundPrepare(id, { amount: '50.00' })
  const sig = signRefund(MERCHANT_KEY, phase1)

  // Phase 2 — hand the signature back to get the unsigned on-chain refund tx.
  const phase2 = await merchant.payments.refundPrepare(id, {
    amount: '50.00',
    signature: packSignature(sig),
  })

  // Sign + submit the refund transaction.
  const tx = await merchant.payments.refund(id, {
    signed_transaction: signTransaction(phase2.unsigned_transaction as string, MERCHANT_KEY),
  })
  console.log('Refund submitted:', tx.status)
} catch (err) {
  if (err instanceof Rail0ApiError) console.error(`[${err.code}] ${err.message}`)
  throw err
}
