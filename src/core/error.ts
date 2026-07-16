export class Rail0ApiError extends Error {
  readonly status: number
  readonly error: string

  constructor(status: number, body: { error: string; message: string }) {
    super(body.message)
    this.name = 'Rail0ApiError'
    this.status = status
    this.error = body.error
  }

  /** An actionable next-step hint for this error's code, or undefined if unknown. */
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
  amount_exceeds_capturable: 'amount is above the capturable balance — check capturableAmount on the payment',
  amount_exceeds_refundable: 'amount is above the refundable balance — check refundableAmount on the payment',
  not_capturable: "the payment must be 'authorized' or 'partially_captured' to capture",
  not_voidable: "void is only allowed while 'authorized' with nothing captured — use release for the remainder after a capture",
  not_releasable: 'release opens only after authorizationExpiry',
  not_refundable: 'nothing is refundable — the payment must be charged/captured and within the refund window',
  not_signable: "the payment must be 'unsigned' to sign",
  already_signed: 'the payer signature is already stored — the payee can act now',
  no_signature: 'the payer has not signed yet',
  wrong_mode: "this operation doesn't match the payment's mode (authorize vs charge)",
  already_disputed: 'a dispute is already open — close it first',
  not_disputed: 'there is no open dispute to close',
  nothing_to_dispute: 'a dispute needs a merchant-held (refundable) balance',
  transaction_not_overwritable: 'a transaction for this operation is already in flight — wait for it to settle',
  signer_mismatch: "the signing key doesn't match the payment's payer/payee",
  // contract reverts (surfaced as contract_revert, or on a failed transaction)
  not_payee: 'only the merchant (payee) may do this',
  not_payer: 'only the buyer (payer) may do this',
  not_payer_or_payee: 'only the payer or the payee may do this',
  refund_expired: 'the refund window has closed (refundExpiry passed) — refund/dispute is no longer possible',
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
