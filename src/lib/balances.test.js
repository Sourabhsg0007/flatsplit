import { describe, expect, it } from 'vitest'
import {
  computeNetBalances,
  computeSplits,
  computeTotalGroupExpenses,
  computeTotalSpent,
  round2,
  simplifyDebts,
} from './balances'

describe('computeSplits', () => {
  const ids = ['a', 'b', 'c']

  it('splits equally with largest-remainder cents', () => {
    const splits = computeSplits('equal', 100.01, ids.map((id) => ({ user_id: id })))
    expect(splits.reduce((s, x) => s + x.amount, 0)).toBeCloseTo(100.01, 2)
    expect(splits.map((s) => s.amount).sort()).toEqual([33.33, 33.34, 33.34])
  })

  it('splits equally over a subset', () => {
    const splits = computeSplits(
      'equal',
      60,
      ids.map((id, i) => ({ user_id: id, included: i < 2 }))
    )
    expect(splits).toEqual([
      { user_id: 'a', amount: 30 },
      { user_id: 'b', amount: 30 },
    ])
  })

  it('rejects exact amounts that do not sum to total', () => {
    expect(() =>
      computeSplits(
        'exact',
        100,
        ids.map((id) => ({ user_id: id, value: '30' }))
      )
    ).toThrow(/add up to 90.00/)
  })

  it('accepts exact amounts that sum to the total', () => {
    const splits = computeSplits('exact', 100, [
      { user_id: 'a', value: '50.25' },
      { user_id: 'b', value: '49.75' },
      { user_id: 'c', value: '0' },
    ])
    expect(splits.reduce((s, x) => s + x.amount, 0)).toBe(100)
  })

  it('rejects percentages not totaling 100', () => {
    expect(() =>
      computeSplits('percent', 100, ids.map((id) => ({ user_id: id, value: '20' })))
    ).toThrow(/60%/)
  })

  it('allocates percent splits via largest remainder', () => {
    const splits = computeSplits('percent', 100.05, [
      { user_id: 'a', value: '50' },
      { user_id: 'b', value: '30' },
      { user_id: 'c', value: '20' },
    ])
    expect(splits.reduce((s, x) => s + x.amount, 0)).toBeCloseTo(100.05, 2)
  })

  it('allocates shares proportionally and sums exactly', () => {
    const splits = computeSplits('shares', 90, [
      { user_id: 'a', value: '2' },
      { user_id: 'b', value: '1' },
    ])
    expect(splits).toEqual([
      { user_id: 'a', amount: 60 },
      { user_id: 'b', amount: 30 },
    ])
  })

  it('throws when no one is included', () => {
    expect(() =>
      computeSplits('equal', 100, ids.map((id) => ({ user_id: id, included: false })))
    ).toThrow(/at least one person/)
  })
})

describe('computeNetBalances', () => {
  it('credits the payer and debits each split', () => {
    const expenses = [
      {
        paid_by: 'a',
        amount: 100,
        splits: [
          { user_id: 'a', amount: 50 },
          { user_id: 'b', amount: 50 },
        ],
      },
    ]
    expect(computeNetBalances(['a', 'b'], expenses, [])).toEqual({ a: 50, b: -50 })
  })

  it('applies settlements in the right direction', () => {
    const settlements = [{ from_user: 'b', to_user: 'a', amount: 30 }]
    expect(computeNetBalances(['a', 'b'], [], settlements)).toEqual({ a: -30, b: 30 })
  })

  it('ignores rows for unknown members', () => {
    const expenses = [
      {
        paid_by: 'ghost',
        amount: 100,
        splits: [{ user_id: 'ghost', amount: 100 }],
      },
    ]
    expect(computeNetBalances(['a'], expenses, [])).toEqual({ a: 0 })
  })
})

describe('simplifyDebts', () => {
  it('returns an empty list when everyone is square', () => {
    expect(simplifyDebts({ a: 0, b: 0 })).toEqual([])
  })

  it('produces minimal transfers that zero balances', () => {
    const transfers = simplifyDebts({ a: 50, b: -30, c: -20 })
    expect(transfers.reduce((s, t) => s + t.amount, 0)).toBeCloseTo(50, 2)
    const applied = { a: 50, b: -30, c: -20 }
    for (const t of transfers) {
      applied[t.from] += t.amount
      applied[t.to] -= t.amount
    }
    expect(applied.a).toBeCloseTo(0, 2)
    expect(applied.b).toBeCloseTo(0, 2)
    expect(applied.c).toBeCloseTo(0, 2)
  })

  it('chains balances through one intermediary when optimal', () => {
    const transfers = simplifyDebts({ a: 80, b: -30, c: -50 })
    expect(transfers.length).toBe(2)
    expect(transfers).toContainEqual({ from: 'b', to: 'a', amount: 30 })
    expect(transfers).toContainEqual({ from: 'c', to: 'a', amount: 50 })
  })
})

describe('totals', () => {
  const expenses = [
    { paid_by: 'a', amount: 100 },
    { paid_by: 'b', amount: 50 },
  ]

  it('computeTotalSpent sums per payer', () => {
    expect(computeTotalSpent(['a', 'b'], expenses)).toEqual({ a: 100, b: 50 })
  })

  it('computeTotalGroupExpenses sums all', () => {
    expect(computeTotalGroupExpenses(expenses)).toBe(150)
  })

  it('round2 keeps two decimals', () => {
    expect(round2(10.456)).toBe(10.46)
    expect(round2(10.454)).toBe(10.45)
  })
})
