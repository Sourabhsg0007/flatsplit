import { describe, expect, it } from 'vitest'
import { extractTransactions, parseAmount, parseStatementDate, txnHash } from './statement'
import { classify } from './classify'
import { analyzePersonality } from './personality'

describe('statement date parsing', () => {
  it('handles the common Indian bank formats', () => {
    expect(parseStatementDate('01/08/2026')).toBe('2026-08-01')
    expect(parseStatementDate('1-8-26')).toBe('2026-08-01')
    expect(parseStatementDate('2026-08-01')).toBe('2026-08-01')
    expect(parseStatementDate('01 Aug 2026')).toBe('2026-08-01')
    expect(parseStatementDate('01-Aug-26')).toBe('2026-08-01')
    expect(parseStatementDate('garbage')).toBeNull()
  })
})

describe('amount parsing', () => {
  it('strips currency symbols, commas and INR markers', () => {
    expect(parseAmount('1,234.56')).toBe(1234.56)
    expect(parseAmount('₹ 500')).toBe(500)
    expect(parseAmount('INR 99.00')).toBe(99)
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('n/a')).toBeNull()
  })
})

describe('extractTransactions', () => {
  const hdfcStyle = `Account Statement,,,,,
Some Bank Ltd,,,,,
Txn Date,Narration,Ref No,Withdrawal Amt,Deposit Amt,Balance
01/08/2026,UPI-SWIGGY-ORDER,882101,340.00,,54660.00
02/08/2026,NEFT SALARY CREDIT,SAL01,,85000.00,139660.00
03/08/2026,"UPI-BLINKIT, GROCERIES",772201,"1,645.50",,138014.50
bad row,,,,,
`
  it('skips junk headers, credits and bad rows; keeps debits', () => {
    const { transactions, skipped } = extractTransactions(hdfcStyle)
    expect(transactions).toHaveLength(2)
    expect(transactions[0]).toEqual({ date: '2026-08-01', description: 'UPI-SWIGGY-ORDER', amount: 340 })
    expect(transactions[1].amount).toBe(1645.5)
    expect(transactions[1].description).toContain('BLINKIT')
    expect(skipped).toBe(2) // salary credit + bad row
  })

  it('handles single signed-amount columns (negative = spent)', () => {
    const signed = `Date,Description,Amount
2026-08-01,SWIGGY ORDER,-340.00
2026-08-02,SALARY,85000.00
`
    const { transactions } = extractTransactions(signed)
    expect(transactions).toHaveLength(1)
    expect(transactions[0].amount).toBe(340)
  })

  it('handles Dr/Cr type columns', () => {
    const typed = `Date,Particulars,Amount,Dr/Cr
2026-08-01,ZOMATO ORDER,520.00,DR
2026-08-02,REFUND,120.00,CR
`
    const { transactions } = extractTransactions(typed)
    expect(transactions).toHaveLength(1)
    expect(transactions[0].description).toBe('ZOMATO ORDER')
  })

  it('errors gracefully on unrecognisable files', () => {
    const { transactions, error } = extractTransactions('hello world\nnothing here')
    expect(transactions).toHaveLength(0)
    expect(error).toBeTruthy()
  })
})

describe('txnHash', () => {
  it('is stable and whitespace/case-insensitive on description', () => {
    const a = txnHash({ date: '2026-08-01', amount: 340, description: 'UPI-SWIGGY  Order' })
    const b = txnHash({ date: '2026-08-01', amount: 340, description: 'upi-swiggy order' })
    const c = txnHash({ date: '2026-08-01', amount: 341, description: 'upi-swiggy order' })
    expect(a).toBe(b)
    expect(a).not.toBe(c)
  })
})

describe('classify', () => {
  it('maps Indian merchants to app categories', () => {
    expect(classify('UPI-SWIGGY-ORDER 8821')).toBe('Food & Groceries')
    expect(classify('UPI-BLINKIT GROCERIES')).toBe('Food & Groceries')
    expect(classify('ACH-NETFLIX SUBSCRIPTION')).toBe('Subscriptions')
    expect(classify('UPI-UBER TRIP')).toBe('Transportation')
    expect(classify('BESCOM ELECTRICITY BILL')).toBe('Utilities')
    expect(classify('POS AMAZON RETAIL')).toBe('Shopping')
    expect(classify('UPI-APOLLO PHARMACY')).toBe('Health')
    expect(classify('RENT AUG TRANSFER')).toBe('Rent')
    expect(classify('UPI-BOOKMYSHOW PVR')).toBe('Entertainment')
    expect(classify('SOMETHING UNKNOWN 42')).toBe('Other')
  })
})

describe('analyzePersonality', () => {
  const mk = (amount, category, date, description = 'x') => ({ amount, category, expense_date: date, description })

  it('needs at least 5 spends', () => {
    const p = analyzePersonality([mk(100, 'Other', '2026-08-01')])
    expect(p.enough).toBe(false)
    expect(p.archetype.name).toMatch(/Started/)
  })

  it('crowns The Foodie when food dominates', () => {
    const items = [
      mk(500, 'Food & Groceries', '2026-08-03'), mk(400, 'Food & Groceries', '2026-08-04'),
      mk(450, 'Food & Groceries', '2026-08-05'), mk(300, 'Shopping', '2026-08-06'),
      mk(200, 'Transportation', '2026-08-07'), mk(150, 'Other', '2026-08-10'),
    ]
    const p = analyzePersonality(items)
    expect(p.enough).toBe(true)
    expect(p.archetype.name).toBe('The Foodie')
    expect(p.traits.find((t) => t.label === 'Top category').value).toBe('Food & Groceries')
  })

  it('computes weekend share from dates', () => {
    // 2026-08-01 is a Saturday, 2026-08-02 a Sunday
    const items = [
      mk(500, 'Entertainment', '2026-08-01'), mk(500, 'Shopping', '2026-08-02'),
      mk(100, 'Other', '2026-08-03'), mk(100, 'Other', '2026-08-04'),
      mk(100, 'Other', '2026-08-05'), mk(100, 'Other', '2026-08-06'),
    ]
    const p = analyzePersonality(items)
    const weekend = p.traits.find((t) => t.label === 'Weekend spending')
    expect(weekend.value).toBe('71%') // 1000 / 1400
  })
})

describe('fmtMoneyShort (lakh-proof box formatting)', async () => {
  const { fmtMoneyShort } = await import('./balances')
  it('keeps paise under ₹1,000, drops them above', () => {
    expect(fmtMoneyShort(340.5, '₹')).toBe('₹340.50')
    expect(fmtMoneyShort(15147.34, '₹')).toBe('₹15,147')
  })
  it('uses Indian lakh/crore grouping and stays short', () => {
    expect(fmtMoneyShort(125000, '₹')).toBe('₹1,25,000')
    expect(fmtMoneyShort(12345678.9, '₹')).toBe('₹1,23,45,679')
    expect(fmtMoneyShort(12345678.9, '₹').length).toBeLessThanOrEqual(12)
  })
})
