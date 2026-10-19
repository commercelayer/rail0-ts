import { describe, expect, it } from 'vitest'
import { signTransaction } from '../src/signing.js'
import {
  canonicalOperation,
  RAIL0_FUNCTION_SIGNATURES,
  RAIL0_SELECTORS,
  type Rail0Operation,
  signerAddress,
  type TxExpectation,
  verifyUnsignedTransaction,
} from '../src/tx-verify.js'

// signTransaction used to sign whatever the gateway returned. These pin the checks that
// now run before the key touches the transaction — ported from the CLI's
// cmd/tx_verify_test.go, which is the reference for what must pass and what must refuse.

const PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const
const SIGNER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
const RAIL0_ID = '0xa1b2c3d40000000000000000000000000000000000000000000000000000beef'
const RAIL0_CONTRACT = '0x2222222222222222222222222222222222222222'
const CHAIN_ID = 84532

const payment = {
  chain_id: CHAIN_ID,
  rail0_id: RAIL0_ID,
  rail0_contract: RAIL0_CONTRACT,
  decimals: 6,
}

// RAIL0 calldata the way the ABI lays it out: selector, paymentId, the six inline
// Payment words (zeros — their content is not checked), then any trailing arguments.
function calldataFor(op: string, rail0Id = RAIL0_ID, amountUnits?: string): string {
  const key = canonicalOperation(op) as Rail0Operation
  let data = `0x${RAIL0_SELECTORS[key]}${rail0Id.slice(2).toLowerCase()}${'0'.repeat(64 * 6)}`
  if (amountUnits !== undefined) data += BigInt(amountUnits).toString(16).padStart(64, '0')
  if (key === 'refund') data += '0'.repeat(64 * 3) // v, r, s
  return data
}

function unsigned(overrides: Record<string, unknown> = {}, op = 'void'): string {
  return JSON.stringify({
    chain_id: CHAIN_ID,
    from: SIGNER,
    to: RAIL0_CONTRACT,
    value: 0,
    data: calldataFor(op),
    nonce: 7,
    gas_limit: 200000,
    max_priority_fee_per_gas: 1000000,
    max_fee_per_gas: 2000000000,
    ...overrides,
  })
}

const expect_ = (operation: string, amount?: string): TxExpectation => ({
  payment,
  operation,
  amount,
})

// The selectors are pinned against RAIL0.sol's compiled methodIdentifiers
// (rail0/contracts/out/RAIL0.sol/RAIL0.json), not against the table they are computed
// from — a typo in a signature string would otherwise agree with itself.
describe('RAIL0_SELECTORS', () => {
  it('match the contract ABI', () => {
    expect(RAIL0_SELECTORS).toEqual({
      authorize: 'c36c951c',
      charge: '1eddc5e5',
      capture: '11bf1806',
      void: '69438554',
      release: '955b0ee2',
      refund: 'e8ed339d',
      dispute: 'eebaa720',
      close_dispute: '6e6923ab',
    })
    expect(Object.keys(RAIL0_FUNCTION_SIGNATURES)).toHaveLength(8)
  })

  it('canonicalOperation folds the SDK method, label and wire vocabularies', () => {
    for (const v of ['close_dispute', 'closeDispute', 'close dispute', ' Close-Dispute ']) {
      expect(canonicalOperation(v)).toBe('close_dispute')
    }
    expect(canonicalOperation('capture')).toBe('capture')
  })
})

describe('verifyUnsignedTransaction', () => {
  it('accepts the right call for each operation, case-insensitively on addresses', () => {
    for (const op of ['authorize', 'charge', 'void', 'release', 'dispute', 'close_dispute']) {
      expect(() => verifyUnsignedTransaction(unsigned({}, op), expect_(op), SIGNER)).not.toThrow()
    }
    for (const op of ['capture', 'refund']) {
      const tx = unsigned({ data: calldataFor(op, RAIL0_ID, '1500000') }, op)
      expect(() => verifyUnsignedTransaction(tx, expect_(op, '1.5'), SIGNER)).not.toThrow()
    }
    const upper = unsigned({ from: SIGNER.toUpperCase(), to: RAIL0_CONTRACT.toUpperCase() })
    expect(() => verifyUnsignedTransaction(upper, expect_('void'), SIGNER)).not.toThrow()
    // The SDK method's spelling is accepted too.
    expect(() =>
      verifyUnsignedTransaction(unsigned({}, 'close_dispute'), expect_('closeDispute'), SIGNER),
    ).not.toThrow()
  })

  it('accepts a pre-parsed object as well as the JSON string', () => {
    expect(() =>
      verifyUnsignedTransaction(JSON.parse(unsigned()), expect_('void'), SIGNER),
    ).not.toThrow()
  })

  it.each([
    ['attaches native currency', { value: 1000000000000000000 }, /attaches native currency/],
    ['native value as a hex quantity', { value: '0xde0b6b3a7640000' }, /attaches native currency/],
    ['native value as a decimal string', { value: '1' }, /attaches native currency/],
    ['wrong chain', { chain_id: 1 }, /targets chain 1 but this payment is on chain 84532/],
    [
      'prepared for a different account',
      { from: '0x9999999999999999999999999999999999999999' },
      /prepared from 0x9999.* but the signing key is/,
    ],
    [
      'addressed to another contract',
      { to: '0x3333333333333333333333333333333333333333' },
      /RAIL0 contract is 0x2222/,
    ],
    [
      'calldata acts on a different payment',
      { data: calldataFor('void', `0x${'ab'.repeat(32)}`) },
      /acts on payment 0xabab.* but you asked for 0xa1b2/,
    ],
    [
      // The profitable swap: approve(spender, MAX) on the token contract. Its selector is
      // not a RAIL0 one, and its first argument is a left-padded address.
      'approve(spender, MAX) on the token',
      { data: `0x095ea7b3${'0'.repeat(24)}${'9'.repeat(40)}${'f'.repeat(64)}` },
      /selector 0x095ea7b3/,
    ],
    ['calldata too short for a selector', { data: '0xdead' }, /too short/],
    ['no calldata at all', { data: '' }, /too short/],
  ])('refuses a hostile transaction: %s', (_name, overrides, message) => {
    expect(() => verifyUnsignedTransaction(unsigned(overrides), expect_('void'), SIGNER)).toThrow(
      /^refusing to sign:/,
    )
    expect(() => verifyUnsignedTransaction(unsigned(overrides), expect_('void'), SIGNER)).toThrow(
      message,
    )
  })

  it('refuses unparseable JSON', () => {
    expect(() => verifyUnsignedTransaction('{not json', expect_('void'))).toThrow(
      /refusing to sign: .*not valid JSON/,
    )
  })

  it('accepts every encoding of zero and nothing else', () => {
    for (const value of [undefined, null, 0, '0', '0x0', '0X0', ' 0 ', '']) {
      expect(() => verifyUnsignedTransaction(unsigned({ value }), expect_('void'))).not.toThrow()
    }
    for (const value of [1, '0x1', '00', '0.0', '-0', '99999999999999999999999999', true]) {
      expect(() => verifyUnsignedTransaction(unsigned({ value }), expect_('void'))).toThrow(
        /attaches native currency/,
      )
    }
  })

  // The swaps the payment-id check alone cannot see: the right payment, the wrong
  // function. Each would have been signed before.
  it.each([
    ['capture', 'void', undefined],
    ['void', 'capture', '1000000'],
    ['capture', 'release', undefined],
    ['release', 'capture', '1000000'],
    ['dispute', 'close_dispute', undefined],
    ['close_dispute', 'dispute', undefined],
    ['refund', 'capture', '1000000'],
  ])('refuses a swapped operation: asked %s, served %s', (asked, served, amount) => {
    const tx = unsigned({ data: calldataFor(served, RAIL0_ID, amount) })
    const name = RAIL0_FUNCTION_SIGNATURES[served as Rail0Operation].split('(')[0]
    expect(() => verifyUnsignedTransaction(tx, expect_(asked, '1'), SIGNER)).toThrow(
      new RegExp(`refusing to sign: the call is ${name}\\(\\) but you asked to ${asked}`),
    )
  })

  it('refuses a capture or refund for an amount other than asked for, naming both', () => {
    for (const op of ['capture', 'refund']) {
      const inflated = unsigned({ data: calldataFor(op, RAIL0_ID, '999000000') })
      expect(() => verifyUnsignedTransaction(inflated, expect_(op, '1'), SIGNER)).toThrow(
        /would \w+ 999000000 base units but you asked for 1000000/,
      )
      // Truncated before the amount word.
      let short = calldataFor(op)
      if (op === 'refund') short = short.slice(0, -64 * 3)
      expect(() =>
        verifyUnsignedTransaction(unsigned({ data: short }), expect_(op, '1'), SIGNER),
      ).toThrow(/too short to carry the \w+ amount/)
    }
  })

  it('fails closed on what it cannot compare', () => {
    const capture = unsigned({ data: calldataFor('capture', RAIL0_ID, '1000000') })
    // An amount-taking operation with no amount to compare against.
    expect(() => verifyUnsignedTransaction(capture, expect_('capture'), SIGNER)).toThrow(
      /cannot check the capture amount without the amount you asked for/,
    )
    // …or with no decimals to scale it by.
    expect(() =>
      verifyUnsignedTransaction(
        capture,
        { payment: { ...payment, decimals: null }, operation: 'capture', amount: '1' },
        SIGNER,
      ),
    ).toThrow(/decimals are unknown/)
    // An amount finer than the token allows is a refusal, not a silent truncation.
    expect(() => verifyUnsignedTransaction(capture, expect_('capture', '1.0000001'))).toThrow(
      /refusing to sign: amount "1.0000001"/,
    )
    // An operation with no known selector.
    expect(() => verifyUnsignedTransaction(unsigned(), expect_('approve'))).toThrow(
      /no known RAIL0 function for operation "approve"/,
    )
  })

  it('skips the comparisons the payment record cannot support, but never the value', () => {
    const sparse = { payment: {}, operation: 'void' }
    expect(() => verifyUnsignedTransaction(unsigned(), sparse)).not.toThrow()
    expect(() => verifyUnsignedTransaction(unsigned({ value: 1 }), sparse)).toThrow(
      /attaches native currency/,
    )
    // No usable rail0_id: nothing to assert rather than a false alarm.
    for (const rail0_id of ['', '0x', 'not-an-id', '0xabc', null]) {
      expect(() =>
        verifyUnsignedTransaction(unsigned(), { payment: { rail0_id }, operation: 'void' }),
      ).not.toThrow()
    }
  })

  it('names the operation before the payment id when both are wrong', () => {
    const tx = unsigned({ data: calldataFor('capture', `0x${'ab'.repeat(32)}`, '1') })
    expect(() => verifyUnsignedTransaction(tx, expect_('void'))).toThrow(/the call is capture\(\)/)
  })
})

describe('signTransaction with an expectation', () => {
  it('signs a transaction that passes the checks', () => {
    const raw = signTransaction(unsigned(), PRIVATE_KEY, expect_('void'))
    expect(raw.startsWith('0x02')).toBe(true)
    expect(raw).toBe(signTransaction(unsigned(), PRIVATE_KEY))
  })

  it('refuses before signing, with the key as the expected sender', () => {
    expect(() => signTransaction(unsigned({ value: 1 }), PRIVATE_KEY, expect_('void'))).toThrow(
      /refusing to sign/,
    )
    const other = unsigned({ from: '0x9999999999999999999999999999999999999999' })
    expect(() => signTransaction(other, PRIVATE_KEY, expect_('void'))).toThrow(
      new RegExp(`the signing key is ${SIGNER.toLowerCase()}`),
    )
    // The raw key bytes work the same as the hex form.
    const bytes = Uint8Array.from(Buffer.from(PRIVATE_KEY.slice(2), 'hex'))
    expect(() => signTransaction(other, bytes, expect_('void'))).toThrow(/the signing key is/)
  })

  it('derives the signer address from the key', () => {
    expect(signerAddress(PRIVATE_KEY)).toBe(SIGNER.toLowerCase())
  })
})
