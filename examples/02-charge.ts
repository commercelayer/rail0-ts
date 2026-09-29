/**
 * One-shot charge: create → sign → charge.
 *
 * `mode: 'charge'` pays the payee through in a single on-chain call — no escrow,
 * no separate capture. Use it when there's nothing to hold funds for (instant
 * settlement). The buyer still signs an EIP-3009 payload; the payee broadcasts.
 *
 * As in 01: every /payments route needs a session, the buyer's client creates and
 * signs (payer must be the signed-in address), the merchant's client charges.
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

const BUYER_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const MERCHANT_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'

const buyer = new Rail0Client({ baseUrl: BASE_URL })
const merchant = new Rail0Client({ baseUrl: BASE_URL })

try {
  await buyer.auth.login(BUYER_KEY, DOMAIN)
  await merchant.auth.login(MERCHANT_KEY, DOMAIN)

  const created = await buyer.payments.create({
    chain_id: 8453,
    mode: 'charge',
    amount: '25.00', // human decimal — the gateway converts to base units
    token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    payer: addressFromPrivateKey(BUYER_KEY),
    payee: addressFromPrivateKey(MERCHANT_KEY),
  })
  const id = created.rail0_id as string

  const sig = signPayment(BUYER_KEY, created)
  await buyer.payments.sign(id, { signature: packSignature(sig) })

  const prep = await merchant.payments.chargePrepare(id)
  const tx = await merchant.payments.charge(id, {
    signed_transaction: signTransaction(prep.unsigned_transaction as string, MERCHANT_KEY),
  })
  console.log('Charge submitted:', tx.status)
} catch (err) {
  if (err instanceof Rail0ApiError) console.error(`[${err.code}] ${err.message}`)
  throw err
}
