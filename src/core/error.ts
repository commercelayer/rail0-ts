import type { ApiErrorBody } from '../resources/types.js'

export class Rail0ApiError extends Error {
  readonly status: number
  /**
   * The specific condition, and the only field to branch on — e.g. "not_capturable",
   * "insufficient_token_balance", "insufficient_gas_funds".
   *
   * Straight from the gateway's `code`, with no fallback chain any more: the error body
   * was trimmed to exactly code/title/detail and the `error`/`status` aliases were
   * deleted rather than dual-sent (rail0-gateway#252), so a fallback would only ever
   * read fields that cannot arrive.
   */
  readonly code: string
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
    super(body.detail ?? `HTTP ${status}`)
    this.name = 'Rail0ApiError'
    this.status = status
    this.code = body.code
    // Assigned only when present: exactOptionalPropertyTypes rejects an explicit
    // undefined on an optional field (same reason retryAfter is guarded below).
    const detail = body.detail
    if (body.title !== undefined) this.title = body.title
    if (detail !== undefined) this.detail = detail
    if (retryAfter !== undefined) this.retryAfter = retryAfter
  }

  /**
   * @deprecated Use `code`. Kept as an alias, deliberately rather than removed: it is
   * what consumers branch on today (rail0-starter's checkout retry guard reads
   * `error.error === 'already_signed'`), and a property that quietly became undefined
   * would turn every such guard into a silently-never-matching condition — the failure
   * mode a rename is supposed to prevent. It now always equals `code`.
   */
  get error(): string {
    return this.code
  }

  /**
   * This SDK's own actionable next step for the code, or undefined when it has none.
   * A SUPPLEMENT to `detail` (which the gateway always sends), not a replacement.
   */
  get hint(): string | undefined {
    return describeError(this.code)
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
  // The SIWE BINDING failures, split out of signer_mismatch so a login failure says
  // WHICH part of the proof did not bind (rail0-gateway#216). None of these hints names
  // the server's expectation — a 422 here is unauthenticated, so echoing the allow-list
  // or the expected chain id would turn each one into a probe.
  siwe_domain_not_allowed:
    "sign with the origin the front-end is served from, and have it added to the gateway's SIWE domain allow-list",
  siwe_uri_mismatch: "the message's uri host must equal its own domain",
  siwe_chain_mismatch:
    'use the chain id the client library sends — this login is off-chain and nominal',
  siwe_proof_expired: 'get a fresh nonce and sign again',
  // Address-wide, not one token: "sign in again", not "that token is dead".
  sessions_revoked:
    "every session issued before this address's revoke-all cutoff is refused — sign in again",
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
  // create-time rejections. Wording kept identical to rail0-go, which is the reference
  // table: this one had drifted six codes behind it — the same drift rail0-ruby fixed
  // in its #13, and it matters most here, because rail0-admin renders these strings to
  // a merchant through describeError. A code missing from this map is not a missing
  // hint, it is a developer-facing gateway `detail` shown to someone who did not send
  // the request.
  unsupported_payment_method:
    "the payee (merchant) doesn't accept this token/chain — check the merchant's payment methods",
  unknown_token: "the token isn't configured on this chain",
  no_active_contract: 'no active RAIL0 contract on that chain',
  missing_param: 'a required parameter is missing from the request',
  // A BARE forbidden is not a party mismatch: the gateway split those into codes of
  // their own (not_the_payee, not_the_payer, wallet_deactivated, not_your_account)
  // because they need different fixes, and its own catalogue reads "this session is
  // not allowed to perform that operation". This entry kept describing one of the
  // split-out cases long after the split, so an admin whose operator grant lapsed was
  // told about payers — and the rule it named no longer exists in the gateway at all.
  forbidden:
    'not permitted for this session — typically the operator grant, a resource owned by another account, or a transaction signed by the wrong wallet',
  idempotency_key_reused:
    'that Idempotency-Key was already used for a payment with different terms — reuse it only to retry the same request, or pick a new key',
}

/**
 * describeError returns an actionable hint for a rail0 error code (a gateway
 * state-guard code or a contract revert), or undefined when the code is unknown.
 */
export function describeError(code: string | null | undefined): string | undefined {
  if (!code) return undefined
  return errorHints[code]
}
