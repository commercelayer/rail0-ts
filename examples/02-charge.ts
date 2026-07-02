/**
 * One-shot charge: create → sign → charge.
 *
 * `mode: 'charge'` pays the payee through in a single on-chain call — no escrow,
 * no separate capture. Use it when there's nothing to hold funds for (instant
 * settlement). The buyer still signs an EIP-3009 payload; the payee broadcasts.
 */

import { Rail0ApiError, Rail0Client, signPayment, signTransaction } from '../src/index.js'

const client = new Rail0Client({ baseUrl: 'https://api.rail0.xyz' })

const BUYER_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const PAYEE_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'

const packSig = (sig: { v: number; r: string; s: string }): string =>
  `${sig.r}${sig.s.slice(2)}${sig.v.toString(16).padStart(2, '0')}`

try {
  const created = await client.payments.create({
    chain_id: 8453,
    mode: 'charge',
    amount: '25000000', // 25 USDC
    token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    payer: '0xBuyerAddress000000000000000000000000000000',
    payee: '0xMerchantAddress0000000000000000000000000000',
  })
  const id = created.rail0_id as string

  const sig = signPayment(BUYER_KEY, created)
  await client.payments.sign(id, { signature: packSig(sig) })

  const prep = await client.payments.chargePrepare(id)
  const tx = await client.payments.charge(id, {
    signed_transaction: signTransaction(prep.unsigned_transaction as string, PAYEE_KEY),
  })
  console.log('Charge submitted:', tx.status)
} catch (err) {
  if (err instanceof Rail0ApiError) console.error(`[${err.error}] ${err.message}`)
  throw err
}
