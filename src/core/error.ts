import type { ApiErrorBody } from '../resources/types.js'

export class Rail0ApiError extends Error {
  readonly status: number
  /**
   * The specific condition, and the only field to branch on — e.g. "not_capturable",
   * "insufficient_token_balance", "insufficient_gas_funds". Read from the gateway's
   * `code`, falling back to the older `error` sub-code and then to `status` (the
   * wider family) so an older gateway still yields the most specific value it sent.
   */
  readonly error: string
  /** Short label for the failure, e.g. "Not enough balance". */
  readonly title?: string
  /**
   * One or two sentences fit to show a user verbatim. Comes from the gateway's error
   * catalogue, so the same condition always reads the same way wherever it surfaced.
   * This is what to render; `hint` is only a supplement.
   */
  readonly detail?: string
  /**
   * Seconds to wait before retrying, parsed from the `Retry-After` response header.
   * Present only on 429 (rate-limited) responses that advertise a window.
   */
  readonly retryAfter?: number

  constructor(status: number, body: ApiErrorBody, retryAfter?: number) {
    super(body.detail ?? body.message ?? `HTTP ${status}`)
    this.name = 'Rail0ApiError'
    this.status = status
    this.error = body.code ?? body.error ?? body.status
    // Assigned only when present: exactOptionalPropertyTypes rejects an explicit
    // undefined on an optional field (same reason retryAfter is guarded below).
    const detail = body.detail ?? body.message
    if (body.title !== undefined) this.title = body.title
    if (detail !== undefined) this.detail = detail
    if (retryAfter !== undefined) this.retryAfter = retryAfter
  }

  /**
   * This SDK's own actionable next step for the code, or undefined when it has none.
   * A SUPPLEMENT to `detail` (which the gateway always sends), not a replacement.
   */
  get hint(): string | undefined {
    return describeError(this.error)
  }
}

/**
 * errorHints maps a gateway state-guard code or a contract revert (the snake_case
 * Solidity error) to an actionable next step, so a rejected request can explain
 * what to do rather than surfacing a bare code. It is the shared source for the
 * admin UI's locked-action reasons and the CLI's error hints.
 */
const errorHints: Record<string, string> = {
  // payment-state guards (HTTP 422)
  amount_exceeds_capturable:
    'amount is above the capturable balance — check capturableAmount on the payment',
  amount_exceeds_refundable:
    'amount is above the refundable balance — check refundableAmount on the payment',
  not_capturable: "the payment must be 'authorized' or 'partially_captured' to capture",
  not_voidable:
    "void is only allowed while 'authorized' with nothing captured — use release for the remainder after a capture",
  not_releasable: 'release opens only after authorizationExpiry',
  not_refundable:
    'nothing is refundable — the payment must be charged/captured and within the refund window',
  not_signable: "the payment must be 'unsigned' to sign",
  already_signed: 'the payer signature is already stored — the payee can act now',
  no_signature: 'the payer has not signed yet',
  wrong_mode: "this operation doesn't match the payment's mode (authorize vs charge)",
  already_disputed: 'a dispute is already open — close it first',
  not_disputed: 'there is no open dispute to close',
  nothing_to_dispute: 'a dispute needs a merchant-held (refundable) balance',
  transaction_not_overwritable:
    'a transaction for this operation is already in flight — wait for it to settle',
  signer_mismatch: "the signing key doesn't match the payment's payer/payee",
  config_hash_mismatch:
    'the payment record and its on-chain deployment disagree — the payment cannot be operated as recorded',
  payment_not_on_chain:
    'the contract has no record of this payment — its opening transaction may never have confirmed',
  unsupported_contract_version:
    "the payment's RAIL0 deployment is newer or older than this gateway supports — upgrade the gateway",
  // token-level reverts: raised by the ERC-20 / EIP-3009 token, not by RAIL0
  insufficient_token_balance:
    'the paying wallet does not hold enough of the token — top it up and retry',
  invalid_token_signature:
    'the EIP-3009 authorization did not recover to the paying wallet — wrong key, chain, token or amount',
  authorization_already_used:
    'that EIP-3009 authorization was already spent or cancelled — each is single-use, create a fresh payment',
  authorization_not_yet_valid: "the authorization's validAfter is still in the future",
  token_account_blocked: 'the token issuer has blocklisted one of the wallets in this transfer',
  token_paused: 'the token contract is paused by its issuer — no transfer can settle right now',
  // broadcast rejections: the node refused the transaction, it never reached the chain
  insufficient_gas_funds:
    "the sending wallet cannot cover gas — fund it with the chain's native token",
  nonce_too_low: 'a transaction with that nonce is already on-chain — re-prepare the operation',
  replacement_underpriced:
    'another transaction with that nonce is pending and this one does not pay enough to replace it',
  gas_price_too_low: 'the fee is below what the node accepts — re-prepare to pick up current fees',
  already_known:
    'the node already has this exact transaction — wait for it to confirm rather than resending',
  rpc_unavailable: 'no configured RPC endpoint answered — the transaction was not submitted',
  // authorization: which party the session is missing
  not_the_payee: "only the payment's payee can do this — sign in with the merchant's wallet",
  not_the_payer: "only the payment's payer can do this — sign in with the buyer's wallet",
  not_a_participant: 'only the payer and the payee can see or act on a payment',
  // contract reverts (surfaced as contract_revert, or on a failed transaction)
  not_payee: 'only the merchant (payee) may do this',
  not_payer: 'only the buyer (payer) may do this',
  not_payer_or_payee: 'only the payer or the payee may do this',
  refund_expired:
    'the refund window has closed (refundExpiry passed) — refund/dispute is no longer possible',
  authorization_not_expired: 'release opens only after authorizationExpiry — wait until it passes',
  already_captured: 'already (partially) captured — use release for the remainder, not void',
  token_not_accepted: "the token isn't in this deployment's allowlist",
  payment_already_exists: 'a payment with this id already exists on-chain',
}

/**
 * describeError returns an actionable hint for a rail0 error code (a gateway
 * state-guard code or a contract revert), or undefined when the code is unknown.
 */
export function describeError(code: string | null | undefined): string | undefined {
  if (!code) return undefined
  return errorHints[code]
}
