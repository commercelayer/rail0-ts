/**
 * Standard two-step escrow flow: create → sign → authorize → capture.
 *
 *   buyer   creates the payment and signs the EIP-3009 payload
 *   payee   authorizes  → funds move buyer → escrow
 *   payee   captures    → funds move escrow → merchant
 *
 * Alternatives before capture: void (refund the buyer) or, after the
 * authorization expiry, release (by the payer or the payee).
 *
 * Every /payments route requires a SIWE session, and each party acts from its own:
 * the buyer's client creates and signs (the gateway refuses a create whose payer is
 * not the signed-in address, 403 payer_must_be_caller), the merchant's client
 * authorizes and captures.
 */

import {
  addressFromPrivateKey,
  packSignature,
  Rail0ApiError,
  Rail0Client,
  signPayment,
  signTransaction,
} from '../src/index.js'

const BASE_URL = 'https://api.rail0.xyz'
const DOMAIN = 'api.rail0.xyz'

// Example keys — NEVER hardcode real keys. Hardhat accounts #0 / #1.
const BUYER_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const MERCHANT_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'

// One client per party: login installs that party's session on the client it runs on.
const buyer = new Rail0Client({ baseUrl: BASE_URL })
const merchant = new Rail0Client({ baseUrl: BASE_URL })

try {
  await buyer.auth.login(BUYER_KEY, DOMAIN) // an account-less (buyer) session
  await merchant.auth.login(MERCHANT_KEY, DOMAIN) // the payee's account session

  // 1. Buyer creates the payment (mode: authorize → escrow). payer MUST be the session.
  const created = await buyer.payments.create({
    chain_id: 8453,
    mode: 'authorize',
    amount: '50.00', // human decimal — the gateway converts to base units
    token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
    payer: addressFromPrivateKey(BUYER_KEY),
    payee: addressFromPrivateKey(MERCHANT_KEY),
  })
  const id = created.rail0_id as string

  // 2. Buyer signs the EIP-3009 payload the gateway returned, then stores it.
  //    packSignature turns { v, r, s } into the 0x r||s||v hex the gateway wants.
  const sig = signPayment(BUYER_KEY, created)
  await buyer.payments.sign(id, { signature: packSignature(sig) })

  // 3. Merchant authorizes: prepare the tx, sign it, submit it (funds → escrow).
  const authPrep = await merchant.payments.authorizePrepare(id)
  const authTx = await merchant.payments.authorize(id, {
    signed_transaction: signTransaction(authPrep.unsigned_transaction as string, MERCHANT_KEY),
  })
  console.log('Authorize submitted:', authTx.status)

  // 4. Merchant captures once the order is fulfilled (funds escrow → merchant).
  const capPrep = await merchant.payments.capturePrepare(id, '50.00')
  const capTx = await merchant.payments.capture(id, {
    signed_transaction: signTransaction(capPrep.unsigned_transaction as string, MERCHANT_KEY),
  })
  console.log('Capture submitted:', capTx.status)

  // Inspect the live on-chain state at any point (either participant can read it).
  const detail = await merchant.payments.get(id)
  console.log('Status:', detail.status, '— refundable:', detail.refundable_amount)
} catch (err) {
  if (err instanceof Rail0ApiError) console.error(`[${err.code}] ${err.message}`)
  throw err
}
