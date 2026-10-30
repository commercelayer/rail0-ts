/**
 * Merchant cash-out: register a destination → proof → confirm → payout.
 *
 * A payout is a plain ERC-20 `transfer` from one of the merchant's wallets to a
 * deposit address at a venue (an exchange, Circle Mint, another wallet). The gateway
 * builds the transfer; the merchant's key signs it — after the SDK has checked that
 * the transfer is exactly the one asked for (signPayoutTransaction).
 *
 * 1. Register the destination. `confirm_details: true` records the merchant's
 *    statement of the details_v1 text, so it is shown first and sent only on a "yes".
 * 2. Send the proof (a small transfer), wait for it to confirm on-chain, check the
 *    venue credited it, then confirm the destination: it becomes `verified`.
 * 3. Prepare a payout → verify → sign → submit, and poll it to `confirmed`.
 */

import { createInterface } from 'node:readline/promises'
import {
  addressFromPrivateKey,
  PAYOUT_DETAILS_CONFIRMATION,
  type Payout,
  Rail0ApiError,
  Rail0Client,
  signPayoutTransaction,
} from '../src/index.js'

const BASE_URL = 'https://api.rail0.xyz'
const DOMAIN = 'api.rail0.xyz'

const MERCHANT_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'
const CHAIN_ID = 5042002 // Arc Testnet
const USDC = '0x3600000000000000000000000000000000000000'
const USDC_DECIMALS = 6 // from your own records, never from the gateway
const DEPOSIT_ADDRESS = '0x1111111111111111111111111111111111111111' // issued by the venue FOR THIS CHAIN

const merchant = new Rail0Client({ baseUrl: BASE_URL })
const ask = createInterface({ input: process.stdin, output: process.stdout })

/** Polls a payout until it settles; `failed` carries the reason in `error_code`. */
async function settle(id: string): Promise<Payout> {
  for (;;) {
    const payout = await merchant.payouts.get(id)
    if (payout.status === 'confirmed' || payout.status === 'failed') return payout
    await new Promise((resolve) => setTimeout(resolve, 3000))
  }
}

try {
  const session = await merchant.auth.login(MERCHANT_KEY, DOMAIN)
  const wallet = await merchant.wallets.get(
    session.accountId as string,
    addressFromPrivateKey(MERCHANT_KEY),
  )

  // 1. Register — only after the merchant confirms the details_v1 text.
  console.log(`\n${PAYOUT_DETAILS_CONFIRMATION.text}\n`)
  const answer = await ask.question(
    `Deposit address ${DEPOSIT_ADDRESS}, chain ${CHAIN_ID}, USDC, minimum 11 USDC. Confirm? (yes/no) `,
  )
  if (answer.trim().toLowerCase() !== 'yes') throw new Error('details not confirmed')

  const destination = await merchant.payoutDestinations.create({
    wallet_id: wallet.id as string,
    chain_id: CHAIN_ID,
    token: USDC,
    address: DEPOSIT_ADDRESS,
    kind: 'exchange',
    min_amount: '11000000', // the venue's deposit minimum, base units — or no_minimum: true if none
    confirm_details: true, // the merchant said "yes" to the text above
  })
  console.log('Destination registered:', destination.status) // unverified

  // 2. Proof → confirm. The gateway decides the proof amount (raised to min_amount),
  //    so cap it: never more than the minimum here.
  const proof = await merchant.payouts.prepareAndSubmit(
    { destination_id: destination.id, purpose: 'proof' },
    MERCHANT_KEY,
    { destination, maxAmount: '11000000' },
  )
  const provenProof = await settle(proof.id)
  if (provenProof.status !== 'confirmed') throw new Error(`proof ${provenProof.error_code}`)
  await ask.question('Proof confirmed on-chain. Press Enter once the venue shows it credited. ')
  const verified = await merchant.payoutDestinations.confirm(destination.id)
  console.log('Destination:', verified.status) // verified

  // 3. Payout: prepare → verify → sign → submit, step by step.
  const amount = '250.00'
  const payout = await merchant.payouts.prepare({ destination_id: destination.id, amount })
  const signed = signPayoutTransaction(payout.unsigned_transaction, MERCHANT_KEY, {
    payout,
    destination,
    amount,
    decimals: USDC_DECIMALS,
  }) // throws "refusing to sign: …" unless it is exactly transfer(destination, 250 USDC)
  await merchant.payouts.submit(payout.id, { signed_transaction: signed })

  const settled = await settle(payout.id)
  console.log('Payout:', settled.status, settled.transaction_hash ?? '', settled.error_code ?? '')
} catch (err) {
  if (err instanceof Rail0ApiError) console.error(`[${err.code}] ${err.message}`, err.hint ?? '')
  throw err
} finally {
  ask.close()
}
