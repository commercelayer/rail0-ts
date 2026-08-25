// Amount conversion between a human decimal string and the token's base-unit
// integer string, done with plain string/BigInt math so there is no float
// rounding. `decimals` is the token's decimals (6 for USDC, 18 for an 18-dp
// token). Shared so the admin, the CLI and any consumer convert amounts the same
// way instead of each reimplementing it.

/**
 * toBaseUnits converts a human decimal amount ("1.50") to its base-unit integer
 * string ("1500000") for the given decimals. Throws on a malformed amount, negative
 * decimals, or more fractional digits than the token has.
 *
 * It used to TRUNCATE the extra digits, and that was the wrong answer for the one thing
 * this function is for: the gateway answers 422 on an amount a token cannot express, so
 * silently dropping them meant the SDK sent a DIFFERENT amount than the caller wrote and
 * the caller learned about it from a rejected request — or worse, from a successful one
 * for less money. Refusing here names the actual mistake, at the call site. (#26)
 */
export function toBaseUnits(human: string, decimals: number): string {
  if (!Number.isInteger(decimals) || decimals < 0) {
    throw new Error(`invalid decimals: ${decimals}`)
  }
  const s = human.trim()
  if (!/^\d+(\.\d+)?$/.test(s)) {
    throw new Error(`invalid amount: ${human}`)
  }
  const [whole, frac = ''] = s.split('.')
  if (frac.length > decimals) {
    throw new Error(
      `amount ${human} has ${frac.length} decimal places, but this token has ${decimals}`,
    )
  }
  const fracPadded = (frac + '0'.repeat(decimals)).slice(0, decimals)
  const combined = (whole + fracPadded).replace(/^0+/, '')
  return combined === '' ? '0' : combined
}

/**
 * formatAmount renders a base-unit integer string ("1500000") as a human decimal
 * ("1.5") for the given decimals. Trailing zeros in the fraction are trimmed and a
 * whole amount has no decimal point. Returns the input unchanged if it isn't a
 * non-negative integer string.
 */
export function formatAmount(base: string, decimals: number): string {
  const s = base.trim()
  if (!/^\d+$/.test(s)) {
    return base
  }
  if (decimals <= 0) {
    return s
  }
  const padded = s.padStart(decimals + 1, '0')
  const whole = padded.slice(0, padded.length - decimals)
  const frac = padded.slice(padded.length - decimals).replace(/0+$/, '')
  return frac ? `${whole}.${frac}` : whole
}
