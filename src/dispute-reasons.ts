// GENERATED — DO NOT EDIT. Run `pnpm generate` to regenerate.
//
// The dispute-reason dictionary (rail0-gateway#381), emitted from the x-enum-descriptions
// and x-enum-bytes32 arrays of the gateway OpenAPI — build-time constants, no gateway call.
import type {
  Bytes32,
  DisputeCloseReason,
  DisputeOpenReason,
  DisputeSystemCloseReason,
} from './resources/types.js'

/** One dictionary entry: the code, its English description and its on-chain bytes32. */
export interface DisputeReasonEntry<C extends string = string> {
  readonly code: C
  readonly description: string
  /** keccak256("rail0.dispute.<code>"), lowercase 0x-hex. */
  readonly bytes32: Bytes32
}

/** What the gateway reports as the description of a reason outside the dictionary. */
export const UNRECOGNISED_DISPUTE_REASON = 'Unrecognised reason'

/** Reasons a payer may open a dispute with. */
export const DISPUTE_OPEN_REASONS: readonly DisputeReasonEntry<DisputeOpenReason>[] = [
  {
    code: 'not_received',
    description: 'Goods or service not received',
    bytes32: '0x8b8e446d6f906b670526e73bf5502f1db64b2150c42360febf9dec0d075a28f9',
  },
  {
    code: 'not_as_described',
    description: 'Not as described, or not what was ordered',
    bytes32: '0xd7ac93eb8a6f78f2398d7131c7d34ac3cc667872ccd86f9acb2acf0b1c1ce68d',
  },
  {
    code: 'damaged_or_defective',
    description: 'Arrived damaged or defective',
    bytes32: '0xedaf2417cca94f10d7611552c2c3a9a9fcf7aeecb58bc213c9290ea0c7e58f3a',
  },
  {
    code: 'duplicate',
    description: 'Charged twice for the same purchase',
    bytes32: '0x21d2ae9aec01aa72dfe968be0b24b311d8f9b26491ad3f5122ee6bce9c0da16f',
  },
  {
    code: 'incorrect_amount',
    description: 'Amount differs from what was agreed',
    bytes32: '0x668fab4989c1fca438fa96c57778b3a0f1a46766bfbce495d8704fd1b0aa6ab6',
  },
  {
    code: 'cancelled',
    description: 'Order or subscription cancelled but still charged',
    bytes32: '0xf0e563be58fdee0107cd6907d4040a859af4753a93cafa838e374a1b6c6880d4',
  },
  {
    code: 'refund_not_received',
    description: 'A refund promised by the merchant never arrived',
    bytes32: '0x654f13ad1cef4e3e1c74161e98f531e730883aa4d14855ee35546f5485de13ce',
  },
  {
    code: 'unauthorized',
    description: 'Payment not recognised (e.g. a compromised wallet)',
    bytes32: '0x5a8e87ece389352e3ad16b9cc84ecb7348115546c041e079f18011d158934079',
  },
  {
    code: 'other',
    description: 'Other reason, detailed off-chain',
    bytes32: '0x0c507c226b608fa1f2920608f9c8baf135357fe717c6cd9ac355ae6451b63667',
  },
]

/** Reasons a payer may close a dispute with. */
export const DISPUTE_CLOSE_REASONS: readonly DisputeReasonEntry<DisputeCloseReason>[] = [
  {
    code: 'resolved_with_merchant',
    description: 'Resolved with the merchant off-chain',
    bytes32: '0x37b092a939a58d27e17848d569e5abb446933c05d90edb8f2ad69caae8b9416a',
  },
  {
    code: 'withdrawn',
    description: 'Withdrawn by the buyer (a mistake, or changed their mind)',
    bytes32: '0x304c3ad3e1c95131e0e666568cb55d269a5382b83f18dcd07137626b07de4d91',
  },
  {
    code: 'item_received',
    description: 'The disputed goods or service arrived after all',
    bytes32: '0xafa7760b6eaeb3756917ec71a4add26b6982f123779bbefca4af237ed2a9cbb1',
  },
  {
    code: 'other',
    description: 'Other reason',
    bytes32: '0x0c507c226b608fa1f2920608f9c8baf135357fe717c6cd9ac355ae6451b63667',
  },
]

/** Close reasons the protocol records on its own (a full refund auto-closing a dispute) — never sent. */
export const DISPUTE_SYSTEM_CLOSE_REASONS: readonly DisputeReasonEntry<DisputeSystemCloseReason>[] =
  [
    {
      code: 'full_refund',
      description: 'Closed automatically by a full refund',
      bytes32: '0x8d72b2d99f736f70b77d5c4eb77867aa31f7d7be526741b1ba241c1c663b0f6c',
    },
  ]

/**
 * Look up a dispute reason by code (`'not_received'`) or by bytes32 (hex, any case).
 * `side` picks the dictionary: `'open'` searches DISPUTE_OPEN_REASONS, `'close'`
 * searches DISPUTE_CLOSE_REASONS and the system DISPUTE_SYSTEM_CLOSE_REASONS. It is
 * required because the sides overlap — `other` is the same code and bytes32 on both,
 * with a different description. Undefined when the value is outside the dictionary
 * (a direct contract call, or a pre-dictionary zero reason): render
 * UNRECOGNISED_DISPUTE_REASON or the raw bytes32 then.
 */
export function lookupDisputeReason(
  value: string | null | undefined,
  side: 'open',
): DisputeReasonEntry<DisputeOpenReason> | undefined
export function lookupDisputeReason(
  value: string | null | undefined,
  side: 'close',
): DisputeReasonEntry<DisputeCloseReason | DisputeSystemCloseReason> | undefined
export function lookupDisputeReason(
  value: string | null | undefined,
  side: 'open' | 'close',
): DisputeReasonEntry | undefined {
  if (!value) return undefined
  const needle = value.toLowerCase()
  const dictionary: readonly DisputeReasonEntry[] =
    side === 'open'
      ? DISPUTE_OPEN_REASONS
      : [...DISPUTE_CLOSE_REASONS, ...DISPUTE_SYSTEM_CLOSE_REASONS]
  return dictionary.find((r) => r.code === value || r.bytes32 === needle)
}
