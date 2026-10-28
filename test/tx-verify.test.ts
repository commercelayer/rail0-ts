import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { SigningPayload } from '../src/resources/types.js'
import { signPayment, signRefund, signSigningPayload, signTransaction } from '../src/signing.js'
import {
  canonicalOperation,
  RAIL0_FUNCTION_SIGNATURES,
  RAIL0_SELECTORS,
  type Rail0Operation,
  type SigningPayloadExpectation,
  signerAddress,
  type TxExpectation,
  verifySigningPayload,
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

  it('skips the comparisons the payment record cannot support, but never the value or `to`', () => {
    const sparse = { payment: { rail0_contract: RAIL0_CONTRACT }, operation: 'void' }
    expect(() => verifyUnsignedTransaction(unsigned(), sparse)).not.toThrow()
    expect(() => verifyUnsignedTransaction(unsigned({ value: 1 }), sparse)).toThrow(
      /attaches native currency/,
    )
    // No usable rail0_id: nothing to assert rather than a false alarm.
    for (const rail0_id of ['', '0x', 'not-an-id', '0xabc', null]) {
      expect(() =>
        verifyUnsignedTransaction(unsigned(), {
          payment: { rail0_id, rail0_contract: RAIL0_CONTRACT },
          operation: 'void',
        }),
      ).not.toThrow()
    }
    // …but the recipient is never skipped: without the contract there is nothing to hold
    // `to` to, so the check refuses.
    expect(() => verifyUnsignedTransaction(unsigned(), { payment: {}, operation: 'void' })).toThrow(
      /without the payment's rail0_contract/,
    )
  })

  // S1: a missing / "" / null `to` used to skip the comparison, and the signer then
  // encoded the empty recipient — a CONTRACT CREATION deploying the gateway's `data`.
  it('refuses a transaction with no recipient in all three shapes, and a non-address one', () => {
    const noTo = JSON.parse(unsigned())
    delete noTo.to
    const shapes: [string, string][] = [
      ['missing', JSON.stringify(noTo)],
      ['empty', unsigned({ to: '' })],
      ['null', unsigned({ to: null })],
    ]
    for (const [name, tx] of shapes) {
      expect(() => verifyUnsignedTransaction(tx, expect_('void'), SIGNER), name).toThrow(
        /refusing to sign: transaction has no recipient .* would deploy a contract/,
      )
      expect(() => signTransaction(tx, PRIVATE_KEY, expect_('void')), name).toThrow(
        /would deploy a contract/,
      )
    }
    for (const to of ['0x1234', 'not-an-address', 42]) {
      expect(() => verifyUnsignedTransaction(unsigned({ to }), expect_('void'))).toThrow(
        /refusing to sign/,
      )
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

  // The signer refuses an empty recipient on its own, so even the deprecated blind form
  // cannot produce a contract-creation transaction (rail0-go's SignTransaction does too).
  it('refuses an empty or non-address `to` even without an expectation', () => {
    const noTo = JSON.parse(unsigned())
    delete noTo.to
    for (const tx of [
      JSON.stringify(noTo),
      unsigned({ to: '' }),
      unsigned({ to: null }),
      unsigned({ to: '0x12' }),
    ]) {
      expect(() => signTransaction(tx, PRIVATE_KEY)).toThrow(/refusing to sign: invalid to address/)
    }
  })

  // S3: the signer stripped only a lowercase 0x, so `0X…` calldata passed the checks
  // (which normalize either prefix) and was signed with "0X" decoded as a 0x00 byte.
  it('signs 0X-prefixed hex as the same bytes the checks verified', () => {
    const data = calldataFor('void')
    const upper = unsigned({
      data: `0X${data.slice(2).toUpperCase()}`,
      to: `0X${RAIL0_CONTRACT.slice(2)}`,
    })
    expect(() => verifyUnsignedTransaction(upper, expect_('void'), SIGNER)).not.toThrow()
    expect(signTransaction(upper, PRIVATE_KEY, expect_('void'))).toBe(
      signTransaction(unsigned(), PRIVATE_KEY, expect_('void')),
    )
    // Malformed hex throws rather than decoding to zeros.
    expect(() => signTransaction(unsigned({ data: '0xzz' }), PRIVATE_KEY)).toThrow(/invalid hex/)
    expect(() => signTransaction(unsigned({ data: '0xabc' }), PRIVATE_KEY)).toThrow(/invalid hex/)
  })

  it('derives the signer address from the key', () => {
    expect(signerAddress(PRIVATE_KEY)).toBe(SIGNER.toLowerCase())
  })
})

// ── verifySigningPayload ─────────────────────────────────────────────────────
//
// The EIP-712 authorization is the more dangerous artifact: the token honours it
// directly, with no RAIL0 involvement, for up to message.value. Vectors from the CLI's
// cmd/tx_verify_test.go (token 0x33…, attacker 0x44…, contract 0x22…, 1000000 units).

const PAYLOAD_TOKEN = '0x3333333333333333333333333333333333333333'
const ATTACKER = '0x4444444444444444444444444444444444444444'

const payloadPayment = {
  chain_id: CHAIN_ID,
  token: PAYLOAD_TOKEN,
  rail0_contract: RAIL0_CONTRACT,
  amount: '1000000',
  decimals: 6,
}

function testPayload(mutate?: (p: SigningPayload) => void): SigningPayload {
  const p: SigningPayload = {
    primaryType: 'ReceiveWithAuthorization',
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
      ReceiveWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
      ],
    },
    domain: { name: 'USD Coin', version: '2', chainId: CHAIN_ID, verifyingContract: PAYLOAD_TOKEN },
    message: {
      from: SIGNER,
      to: RAIL0_CONTRACT,
      value: '1000000',
      validAfter: '0',
      validBefore: '2000000000',
      nonce: `0x${'ab'.repeat(32)}`,
    },
  }
  mutate?.(p)
  return p
}

const payloadExpect: SigningPayloadExpectation = { payment: payloadPayment, amount: '1' }

describe('verifySigningPayload', () => {
  it('accepts a well-formed payload, case-insensitively on addresses', () => {
    expect(verifySigningPayload(testPayload(), payloadExpect, SIGNER)).toEqual(testPayload())
    const upper = testPayload((p) => {
      p.message.from = SIGNER.toUpperCase().replace('0X', '0x')
      p.domain.verifyingContract = PAYLOAD_TOKEN.toUpperCase().replace('0X', '0x')
      p.message.to = RAIL0_CONTRACT.toUpperCase().replace('0X', '0x')
    })
    expect(() => verifySigningPayload(upper, payloadExpect, SIGNER)).not.toThrow()
    // Without `amount`, the payment's own stored base units are the expectation.
    expect(() =>
      verifySigningPayload(testPayload(), { payment: payloadPayment }, SIGNER),
    ).not.toThrow()
  })

  const hostile: [string, (p: SigningPayload) => void, RegExp][] = [
    // THE case this exists for: a drain of the signer's whole balance.
    [
      'value inflated far past the amount asked for',
      (p) => {
        p.message.value = '999999999999'
      },
      /the authorization is for 999999999999 base units but you asked for 1000000/,
    ],
    [
      'from is not the signing key',
      (p) => {
        p.message.from = ATTACKER
      },
      /the authorization is from 0x4444.* but the signing key is/,
    ],
    [
      'domain names another token',
      (p) => {
        p.domain.verifyingContract = ATTACKER
      },
      /the authorization is against token 0x4444.* but this payment's token is/,
    ],
    [
      'domain names another chain',
      (p) => {
        p.domain.chainId = CHAIN_ID + 1
      },
      /the authorization is scoped to chain 84533 but this payment is on chain 84532/,
    ],
    [
      'pays an address other than the RAIL0 contract',
      (p) => {
        p.message.to = PAYLOAD_TOKEN
      },
      /the authorization pays 0x3333.* but this payment's RAIL0 contract is/,
    ],
    [
      'a smaller value (exact, not a ceiling)',
      (p) => {
        p.message.value = '999999'
      },
      /base units but you asked for 1000000/,
    ],
    [
      'a non-integer value',
      (p) => {
        p.message.value = '1e6'
      },
      /base units but you asked for/,
    ],
  ]
  for (const [name, mutate, want] of hostile) {
    it(`refuses: ${name}`, () => {
      expect(() => verifySigningPayload(testPayload(mutate), payloadExpect, SIGNER)).toThrow(want)
      expect(() => verifySigningPayload(testPayload(mutate), payloadExpect, SIGNER)).toThrow(
        /^refusing to sign: /,
      )
      // And the checked signer produces nothing for it.
      expect(() => signSigningPayload(PRIVATE_KEY, testPayload(mutate), payloadExpect)).toThrow(
        /refusing to sign/,
      )
    })
  }

  it('fails closed on what it cannot compare', () => {
    const p = testPayload()
    expect(() => verifySigningPayload(null, payloadExpect)).toThrow(/no signing payload/)
    expect(() =>
      verifySigningPayload(p, { payment: { ...payloadPayment, chain_id: null } }),
    ).toThrow(/without the payment's chain_id/)
    expect(() => verifySigningPayload(p, { payment: { ...payloadPayment, token: null } })).toThrow(
      /without the payment's token/,
    )
    expect(() =>
      verifySigningPayload(p, { payment: { ...payloadPayment, rail0_contract: null } }),
    ).toThrow(/without the payment's rail0_contract/)
    // No amount and no stored amount.
    expect(() => verifySigningPayload(p, { payment: { ...payloadPayment, amount: null } })).toThrow(
      /cannot check the authorization's amount/,
    )
    // An amount with no decimals to scale it by.
    expect(() =>
      verifySigningPayload(p, { payment: { ...payloadPayment, decimals: null }, amount: '1' }),
    ).toThrow(/decimals are unknown/)
    // An amount finer than the token allows (the CLI's `-a 1.0000001` on USDC).
    expect(() => verifySigningPayload(p, { payment: payloadPayment, amount: '1.0000001' })).toThrow(
      /refusing to sign: amount "1.0000001"/,
    )
    expect(() => verifySigningPayload(p, { payment: payloadPayment, amount: '' })).toThrow(
      /without the amount you asked for/,
    )
  })

  it('scales the human amount by decimals rather than reading the gateway back', () => {
    // A refund of 0.5 against a 1.0 payment: the payment's own amount would refuse it.
    const half = testPayload((p) => {
      p.message.value = '500000'
    })
    expect(() =>
      verifySigningPayload(half, { payment: payloadPayment, amount: '0.5' }),
    ).not.toThrow()
    expect(() => verifySigningPayload(half, { payment: payloadPayment })).toThrow(
      /for 500000 base units but you asked for 1000000/,
    )
  })
})

// The typed-data envelope. A key signer rebuilds the digest from fixed typehashes, but
// a browser wallet hashes whatever `types` says: these are refused before either runs.
type Fields = { name: string; type: string }[]
const fieldsOf = (p: SigningPayload, name: string): Fields => p.types[name] as Fields

describe('verifySigningPayload: the typed-data envelope', () => {
  it("accepts the gateway's own payload (built by Rail0::Eip3009#typed_data)", () => {
    const gateway = JSON.parse(
      readFileSync(new URL('./fixtures/gateway-signing-payload.json', import.meta.url), 'utf8'),
    ) as SigningPayload
    expect(verifySigningPayload(gateway, payloadExpect, SIGNER)).toEqual(gateway)
    expect(() => signSigningPayload(PRIVATE_KEY, gateway, payloadExpect)).not.toThrow()
  })

  it('accepts TransferWithAuthorization (pre-1.4.0 deployments) and an absent EIP712Domain', () => {
    const transfer = testPayload((p) => {
      p.types = {
        EIP712Domain: p.types.EIP712Domain,
        TransferWithAuthorization: p.types.ReceiveWithAuthorization,
      }
      p.primaryType = 'TransferWithAuthorization'
    })
    expect(() => verifySigningPayload(transfer, payloadExpect, SIGNER)).not.toThrow()
    const noDomain = testPayload((p) => {
      delete p.types.EIP712Domain
    })
    expect(() => verifySigningPayload(noDomain, payloadExpect, SIGNER)).not.toThrow()
  })

  const tampered: [string, (p: SigningPayload) => void, RegExp][] = [
    [
      'an unknown primaryType',
      (p) => {
        p.types.Permit = p.types.ReceiveWithAuthorization
        delete p.types.ReceiveWithAuthorization
        p.primaryType = 'Permit'
      },
      /primaryType "Permit" is not an EIP-3009 authorization type/,
    ],
    [
      'a primaryType with no definition in types',
      (p) => {
        p.primaryType = 'TransferWithAuthorization'
      },
      /types define "ReceiveWithAuthorization", which an EIP-3009 authorization does not use/,
    ],
    [
      'reordered fields',
      (p) => {
        const f = fieldsOf(p, 'ReceiveWithAuthorization')
        ;[f[0], f[1]] = [f[1] as Fields[0], f[0] as Fields[0]]
      },
      /types\.ReceiveWithAuthorization is \(address to,address from,/,
    ],
    [
      'a renamed field',
      (p) => {
        ;(fieldsOf(p, 'ReceiveWithAuthorization')[1] as Fields[0]).name = 'recipient'
      },
      /types\.ReceiveWithAuthorization is .*address recipient.* but must be exactly \(address from,address to,/,
    ],
    [
      'a changed field type',
      (p) => {
        ;(fieldsOf(p, 'ReceiveWithAuthorization')[2] as Fields[0]).type = 'uint128'
      },
      /types\.ReceiveWithAuthorization is .*uint128 value/,
    ],
    [
      'an extra field',
      (p) => {
        fieldsOf(p, 'ReceiveWithAuthorization').push({ name: 'spender', type: 'address' })
      },
      /types\.ReceiveWithAuthorization is .*address spender/,
    ],
    [
      'a missing field',
      (p) => {
        fieldsOf(p, 'ReceiveWithAuthorization').pop()
      },
      /types\.ReceiveWithAuthorization is /,
    ],
    [
      'an extra key on a field',
      (p) => {
        ;(fieldsOf(p, 'ReceiveWithAuthorization')[0] as Record<string, string>).note = 'x'
      },
      /types\.ReceiveWithAuthorization is /,
    ],
    [
      'an extra type definition',
      (p) => {
        p.types.Transfer = [{ name: 'to', type: 'address' }]
      },
      /types define "Transfer", which an EIP-3009 authorization does not use/,
    ],
    [
      'a wrong EIP712Domain',
      (p) => {
        fieldsOf(p, 'EIP712Domain').push({ name: 'salt', type: 'bytes32' })
      },
      /types\.EIP712Domain is .*bytes32 salt.* but must be exactly \(string name,string version,uint256 chainId,address verifyingContract\)/,
    ],
    [
      'an EIP712Domain without version',
      (p) => {
        fieldsOf(p, 'EIP712Domain').splice(1, 1)
      },
      /types\.EIP712Domain is \(string name,uint256 chainId,address verifyingContract\)/,
    ],
    [
      'no types at all',
      (p) => {
        ;(p as { types: unknown }).types = undefined
      },
      /the signing payload has no types/,
    ],
    [
      'empty types',
      (p) => {
        p.types = {}
      },
      /types\.ReceiveWithAuthorization is \(null\)/,
    ],
  ]
  for (const [name, mutate, want] of tampered) {
    it(`refuses: ${name}`, () => {
      expect(() => verifySigningPayload(testPayload(mutate), payloadExpect, SIGNER)).toThrow(want)
      expect(() => verifySigningPayload(testPayload(mutate), payloadExpect, SIGNER)).toThrow(
        /^refusing to sign: /,
      )
      expect(() => signSigningPayload(PRIVATE_KEY, testPayload(mutate), payloadExpect)).toThrow(
        /refusing to sign/,
      )
    })
  }
})

describe('signSigningPayload / signPayment / signRefund with an expectation', () => {
  it('sign the same bytes as the blind form when the payload passes', () => {
    const p = testPayload()
    const blind = signSigningPayload(PRIVATE_KEY, p)
    expect(signSigningPayload(PRIVATE_KEY, p, payloadExpect)).toEqual(blind)
    expect(signPayment(PRIVATE_KEY, { signing_payload: p }, payloadExpect)).toEqual(blind)
    expect(signRefund(PRIVATE_KEY, { signing_payload: p }, payloadExpect)).toEqual(blind)
  })

  it('derive the signer from the key, so another key is refused', () => {
    const otherKey = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' as const
    expect(() => signSigningPayload(otherKey, testPayload(), payloadExpect)).toThrow(
      /the authorization is from .* but the signing key is 0x70997970c51812dc3a010c7d01b50e0d17dc79c8/,
    )
    const inflated = {
      signing_payload: testPayload((p) => {
        p.message.value = '50000000000'
      }),
    }
    expect(() => signPayment(PRIVATE_KEY, inflated, payloadExpect)).toThrow(/refusing to sign/)
    expect(() => signRefund(PRIVATE_KEY, inflated, payloadExpect)).toThrow(/refusing to sign/)
  })

  it('keep the missing-payload errors of each wrapper', () => {
    expect(() => signPayment(PRIVATE_KEY, {}, payloadExpect)).toThrow(/no signing_payload/)
    expect(() => signRefund(PRIVATE_KEY, {}, payloadExpect)).toThrow(/call refundPrepare/)
    expect(() => signSigningPayload(PRIVATE_KEY, null, payloadExpect)).toThrow(
      /signing payload is missing/,
    )
  })
})
