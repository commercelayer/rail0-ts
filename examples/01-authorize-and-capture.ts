/**
 * Standard two-step escrow flow: create → sign → authorize → capture.
 *
 *   buyer   creates the payment and signs the EIP-3009 payload
 *   payee   authorizes  → funds move buyer → escrow
 *   payee   captures    → funds move escrow → merchant
 *
 * Alternatives before capture: void (refund the buyer) or, after the
 * authorization expiry, release (permissionless).
 */

import { Rail0ApiError, Rail0Client, signPayment, signTransaction } from '../src/index.js'

const client = new Rail0Client({ baseUrl: 'https://api.rail0.xyz' })

// Example keys — NEVER hardcode real keys. Hardhat accounts #0 / #1.
const BUYER_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const PAYEE_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'

// Pack an { v, r, s } signature into the 65-byte hex the gateway expects.
const packSig = (sig: { v: number; r: string; s: string }): string =>
  `${sig.r}${sig.s.slice(2)}${sig.v.toString(16).padStart(2, '0')}`

try {
  // 1. Buyer creates the payment (mode: authorize → escrow).
  const created = await client.payments.create({
    chain_id: 8453,
    mode: 'authorize',
    amount: '50000000', // 50 USDC (6 decimals)
    token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
    payer: '0xBuyerAddress000000000000000000000000000000',
    payee: '0xMerchantAddress0000000000000000000000000000',
  })
  const id = created.rail0_id as string

  // 2. Buyer signs the EIP-3009 payload the gateway returned, then stores it.
  const sig = signPayment(BUYER_KEY, created)
  await client.payments.sign(id, { signature: packSig(sig) })

  // 3. Payee authorizes: prepare the tx, sign it, submit it (funds → escrow).
  const authPrep = await client.payments.authorizePrepare(id)
  const authTx = await client.payments.authorize(id, {
    signed_transaction: signTransaction(authPrep.unsigned_transaction as string, PAYEE_KEY),
  })
  console.log('Authorize submitted:', authTx.status)

  // 4. Payee captures once the order is fulfilled (funds escrow → merchant).
  const capPrep = await client.payments.capturePrepare(id, '50000000')
  const capTx = await client.payments.capture(id, {
    signed_transaction: signTransaction(capPrep.unsigned_transaction as string, PAYEE_KEY),
  })
  console.log('Capture submitted:', capTx.status)

  // Inspect the live on-chain state at any point.
  const detail = await client.payments.get(id)
  console.log('Status:', detail.status, '— refundable:', detail.refundable_amount)
} catch (err) {
  if (err instanceof Rail0ApiError) console.error(`[${err.error}] ${err.message}`)
  throw err
}
