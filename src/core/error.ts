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
  unknown_dispute_reason:
    'the reason is not in the dispute-reason dictionary — send a code from DISPUTE_OPEN_REASONS / DISPUTE_CLOSE_REASONS (or its exact bytes32); full_refund is recorded by the protocol and cannot be sent',
  transaction_not_overwritable:
    'a transaction for this operation is already in flight — wait for it to settle',
  signer_mismatch:
    "the signature recovers to a different wallet than the one that must sign — the payment's payer/payee, or at POST /claim the wallet the onboarding request names",
  // The SIWE BINDING failures, split out of signer_mismatch so a login failure says
  // WHICH part of the proof did not bind (rail0-gateway#216). None of these hints names
  // the server's expectation — a 422 here is unauthenticated, so echoing the allow-list
  // would turn each one into a probe. siwe_chain_mismatch may point at GET /blockchains:
  // the accepted chain ids (1 plus every active catalog chain) are public there anyway.
  siwe_domain_not_allowed:
    "sign with the origin the front-end is served from, and have it added to the gateway's SIWE domain allow-list",
  siwe_uri_mismatch: "the message's uri host must equal its own domain",
  siwe_chain_mismatch:
    "sign with chain id 1 (what the SDK's signing helpers send) or the id of a chain the gateway has active (GET /blockchains) — usually a hand-built message or a wallet on an unsupported or deactivated network",
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
  not_your_account: 'the session belongs to a different account than the one in the path',
  // A session is bound to the one wallet it signed in with: the account's other wallets
  // are readable, but not this session's to change (operators are exempt).
  not_your_wallet:
    'a session can change only the wallet it signed in with — sign in with that wallet to update it, deactivate it or manage its tokens',
  // POST /accounts/:id/wallets is suspended for every session until the merchant
  // wallet-management section lands.
  wallet_add_unavailable:
    'adding a wallet to an account is not available yet — it returns with the merchant wallet-management section',
  payer_must_be_caller:
    "a payment's payer must be the signed-in wallet — create it from the buyer's session",
  release_submitter_not_a_party:
    "a release can be sent only by the payment's payer or payee — omit `from` to build it for yourself",
  // standing: the session's wallet or account was switched off by its holder or an operator
  // gateway#439: a deactivated session may switch its OWN wallet back on (PATCH
  // active=true) when its owner switched it off; an operator's switch-off is the
  // operator's to lift (wallet_deactivated_by_operator).
  wallet_deactivated:
    "this wallet is deactivated and read-only — if you switched it off, its own session can switch it back on (wallets.update(accountId, id, { active: true })), or sign in with another of the account's wallets",
  wallet_deactivated_by_operator:
    'an operator deactivated this wallet, so only an operator can reactivate it — ask an operator to reactivate it',
  account_deactivated:
    'this merchant account is deactivated — it can still read, void, release and refund, but not create, authorize, charge or capture, and it makes no payout or payout-destination change; ask an operator to reactivate it',
  // last-one guards: login resolves the account FROM a wallet, so an account left with no
  // active wallet could neither act nor add one back; the operator grant has the same floor.
  // Adding a wallet is suspended and a session changes only its own wallet, so the other
  // wallet comes back on from its own session (if its owner switched it off) or from an
  // operator (gateway#439).
  last_active_wallet:
    "this is the account's only active wallet — another wallet must be active before this one can be switched off: sign in with one you switched off and reactivate it, or ask an operator (adding a wallet is not available yet)",
  last_admin:
    'the change would leave no active operator — grant the operator role to another active account first',
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
  validation_failed: 'a parameter is invalid — the detail names the offending field',
  invalid_sort: 'that field cannot be sorted on — the detail names the allowed set',
  rate_limited:
    'too many requests — wait the Retry-After seconds (the time left in the current window) and retry',
  // transaction lifecycle
  not_redrivable:
    'only a pending transaction that already holds its signed bytes can be re-enqueued — submit a signature instead',
  event_not_found:
    'the reported transaction was mined but did not perform this operation on this payment — check the hash and prepare again',
  submission_timeout:
    "the broadcast was not mined within the gateway's window — if it mines later, re-report its hash via the /submitted endpoint",
  // Onboarding: POST /signup and POST /claim (the gateway's onboarding flow).
  // The /admin/onboardings codes (onboarding_not_found, onboarding_completed) are left
  // out: those routes are the console's, not the SDK's. The link codes never say which
  // term failed — a stale link has one remedy: the newest email, or a new link.
  signup_unavailable:
    'self-service sign-up is switched off on this gateway for now — try again later, or ask your RAIL0 contact for an invite',
  onboarding_unavailable:
    'this gateway has no onboarding secret configured, so it can neither issue nor verify sign-up links — ask the operator',
  email_provider_not_configured:
    'the gateway has no email provider that delivers, so no link was sent and nothing was saved — ask the operator to configure one',
  email_domain_not_allowed:
    'this environment emails only its allowed domains (the detail lists them) — use an address on one of them; nothing was saved',
  account_email_taken:
    'an account with this email already exists — sign in with its wallet, or use another email',
  account_wallet_taken:
    'this wallet is already registered to an account — sign in with it, or use another wallet',
  account_name_taken: 'an account with this name already exists — choose another name',
  terms_required:
    'the claim needs terms_version: send the version of the terms the merchant accepted',
  onboarding_link_invalid:
    'the link was altered or its request no longer exists — use the link in the most recent email, or ask for a new one',
  onboarding_link_expired:
    'the link has expired — sign up again, or ask your RAIL0 contact for a new link',
  onboarding_link_superseded:
    'a newer link was sent for this request and this one no longer works — use the link in the most recent email',
  // A BARE forbidden is not a party mismatch: the gateway split those into codes of
  // their own (not_the_payee, not_the_payer, wallet_deactivated, account_deactivated,
  // not_your_account) because they need different fixes, and its own catalogue reads
  // "this session is not allowed to perform that operation". This entry kept
  // describing one of the split-out cases long after the split, so an admin whose
  // operator grant lapsed was told about payers — and the rule it named no longer
  // exists in the gateway at all.
  forbidden:
    'not permitted for this session — typically the operator grant, a resource owned by another account, or a transaction signed by the wrong wallet',
  idempotency_key_reused:
    'that Idempotency-Key was already used for a payment with different terms — reuse it only to retry the same request, or pick a new key',
  // Signatures and sign-in proofs (rail0-gateway lib/rail0/error_catalog.rb).
  invalid_signature:
    'the signature could not be recovered — it is malformed, truncated or has a bad recovery byte; send the 65-byte r‖s‖v hex packSignature builds',
  nonce_used: 'that sign-in nonce was already consumed — request a fresh one, each is single-use',
  siwe_purpose_mismatch:
    "the signed message's statement is for a different flow — login, wallet registration, account claim and revoke-all each need their own exact statement",
  transaction_mismatch:
    'the signed transaction differs from the one this operation prepared (target, calldata, value or chain) — sign the unsigned_transaction prepare returned, unmodified',
  signing_payload_unavailable:
    "the payer's authorization payload could not be built because a chain read failed — retry in a moment",
  // Account limits and the gateway's own infrastructure.
  webhook_limit_reached:
    'the account already holds the most webhook subscriptions it may have — delete one, or add topics to an existing subscription',
  queue_unavailable:
    "the gateway's job queue could not be reached, so nothing was enqueued — retry in a moment",
  unknown_chain: "that chain isn't active on this gateway — check GET /blockchains",
  invalid_amount:
    "the amount is malformed — a payment's amount is a human decimal the token can express; a payout destination's reserve_amount and min_amount are base units (digits only, below 2^120)",
  invalid_transaction: 'the signed transaction could not be decoded — send the raw 0x… bytes',
  invalid_cursor:
    "a cursor page (after) cannot be combined with page or a sort other than -created_at — drop one, or use the previous page's x-next-cursor",
  // Payouts (merchant cash-out): POST /payout_destinations, POST /payouts/*.
  confirmation_required:
    "the merchant must confirm the destination's details (confirm_details: true, the PAYOUT_DETAILS_CONFIRMATION text) — required on create and on any change of min_amount",
  payout_destination_exists:
    'this wallet already has this address for this token and chain — use the existing destination',
  payout_destination_zero_address: 'the destination address is the zero address',
  payout_destination_own_wallet:
    'the destination is the paying wallet itself — use the deposit address from the venue',
  payout_destination_is_contract:
    'the destination is a RAIL0 deployment or a token contract — use the deposit address the venue issued for this chain',
  payout_destination_unverified:
    'the destination is not verified yet — send the proof transfer (purpose: proof) and confirm it once the venue credits it',
  payout_destination_disabled: 'the destination is disabled — re-enable it (active: true) first',
  payout_destination_proof_missing:
    'there is no confirmed proof transfer yet — prepare and submit one (purpose: proof) and wait for it to confirm',
  payout_below_minimum:
    "the amount is below the destination's deposit minimum (min_amount) — the venue would not credit it; send more",
  insufficient_balance:
    "the wallet's balance, after the refund reserve, does not cover the transfer — the detail names what is available",
  payout_limit_reached: 'the wallet has reached its hourly payout limit — wait and try again',
  payout_already_signed:
    'a signed transfer is already stored for this payout and may still be mined — resend it (payouts.resend) instead of preparing or cancelling it',
  payout_not_pending:
    'the payout is no longer pending — it was already submitted, confirmed or failed',
  payout_not_signed: 'there is no signed transfer to resend — submit one first',
  payout_hash_in_use: 'another payout already records this transaction hash',
  foreign_transfer_hash:
    "that transaction is not this payout's transfer (sender, token, amount or recipient differ) — report the hash of the transfer itself",
  // A failed payout's error_code (the settlement's verdict, not a request error).
  foreign_transfer:
    "the mined transaction did not carry this payout's ERC-20 Transfer — nothing was paid to the destination by it",
  dropped:
    'the transfer was not mined and its nonce was spent by another transaction — if a replacement paid it, report that hash via payouts.submitByHash',
  cancelled: 'the payout was cancelled before it was signed — prepare a new one',
}

/**
 * describeError returns an actionable hint for a rail0 error code (a gateway
 * state-guard code or a contract revert), or undefined when the code is unknown.
 */
export function describeError(code: string | null | undefined): string | undefined {
  if (!code) return undefined
  return errorHints[code]
}
