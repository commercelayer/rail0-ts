import { describe, expect, it } from 'vitest'
import { formatAmount, toBaseUnits } from '../src/amounts.js'
import { describeError, Rail0ApiError } from '../src/core/error.js'

describe('toBaseUnits', () => {
  it('converts human decimals to base units', () => {
    expect(toBaseUnits('1.5', 6)).toBe('1500000')
    expect(toBaseUnits('1', 6)).toBe('1000000')
    expect(toBaseUnits('0.000001', 6)).toBe('1')
    expect(toBaseUnits('0', 6)).toBe('0')
    expect(toBaseUnits('0.0', 6)).toBe('0')
    expect(toBaseUnits('10', 0)).toBe('10')
    expect(toBaseUnits('1.5', 18)).toBe('1500000000000000000')
  })

  it('refuses more fractional digits than the token has, rather than truncating', () => {
    // It used to answer '1234567' — a DIFFERENT amount than the caller wrote, which the
    // gateway then 422s (or, worse, accepts for less money). The mistake belongs at the
    // call site. (#26)
    expect(() => toBaseUnits('1.2345678', 6)).toThrow(/7 decimal places, but this token has 6/)
    // The boundary itself is fine: exactly `decimals` digits is exact, not over-precise.
    expect(toBaseUnits('1.234567', 6)).toBe('1234567')
  })

  it('rejects malformed amounts and bad decimals', () => {
    expect(() => toBaseUnits('', 6)).toThrow()
    expect(() => toBaseUnits('1.2.3', 6)).toThrow()
    expect(() => toBaseUnits('abc', 6)).toThrow()
    expect(() => toBaseUnits('-1', 6)).toThrow()
    expect(() => toBaseUnits('1', -1)).toThrow()
  })
})

describe('formatAmount', () => {
  it('renders base units as a human decimal, trimming trailing zeros', () => {
    expect(formatAmount('1500000', 6)).toBe('1.5')
    expect(formatAmount('2000000', 6)).toBe('2')
    expect(formatAmount('1', 6)).toBe('0.000001')
    expect(formatAmount('0', 6)).toBe('0')
    expect(formatAmount('1234567', 6)).toBe('1.234567')
    expect(formatAmount('1500000000000000000', 18)).toBe('1.5')
    expect(formatAmount('10', 0)).toBe('10')
  })

  it('returns the input unchanged when it is not an integer string', () => {
    expect(formatAmount('notanumber', 6)).toBe('notanumber')
  })

  it('round-trips with toBaseUnits', () => {
    for (const h of ['1.5', '0.000001', '1000', '0.25']) {
      const base = toBaseUnits(h, 6)
      expect(toBaseUnits(formatAmount(base, 6), 6)).toBe(base)
    }
  })
})

describe('describeError', () => {
  it('returns a hint for known codes and undefined otherwise', () => {
    expect(describeError('refund_expired')).toBeTruthy()
    expect(describeError('totally_unknown_code')).toBeUndefined()
    expect(describeError(null)).toBeUndefined()
  })

  it('exposes the hint on Rail0ApiError', () => {
    // One field to key on: the body is exactly code/title/detail now, with the `status`
    // and `error` aliases deleted rather than dual-sent (gateway #252).
    const err = new Rail0ApiError(422, {
      code: 'amount_exceeds_capturable',
      title: 'Amount exceeds capturable',
      detail: 'rejected',
    })
    expect(err.hint).toBeTruthy()
    expect(err.code).toBe('amount_exceeds_capturable')
    // The deprecated alias still answers, so a consumer branching on `.error` keeps
    // working instead of matching undefined forever.
    expect(err.error).toBe('amount_exceeds_capturable')
  })
})
