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

  it('truncates fractional digits beyond decimals', () => {
    expect(toBaseUnits('1.2345678', 6)).toBe('1234567')
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
    const err = new Rail0ApiError(422, {
      status: 'invalid_state',
      error: 'amount_exceeds_capturable',
      message: 'rejected',
    })
    expect(err.hint).toBeTruthy()
  })
})
