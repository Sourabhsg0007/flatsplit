import { describe, expect, it } from 'vitest'
import { groupItemsToLines, linesToTransactions } from './pdfText'

// helper: build positioned items for a fake statement page.
// columns: date x=40, narration x=110, withdrawal x=330, deposit x=420, balance x=510
const item = (str, x, y) => ({ str, x, y })
const page = (rows) => rows.flat()

describe('groupItemsToLines', () => {
  it('groups by y with tolerance and sorts by x', () => {
    const lines = groupItemsToLines([
      item('B', 200, 700.8), item('A', 40, 701.4), item('C', 300, 700.1),
      item('next', 40, 680),
    ])
    expect(lines).toHaveLength(2)
    expect(lines[0].cells.map((c) => c.str)).toEqual(['A', 'B', 'C'])
    expect(lines[1].cells[0].str).toBe('next')
  })
})

describe('linesToTransactions', () => {
  const header = [item('Date', 40, 700), item('Narration', 110, 700), item('Withdrawal', 330, 700), item('Deposit', 420, 700), item('Balance', 510, 700)]

  it('reads debit rows, skips credit rows, joins wrapped narration', () => {
    const items = page([
      [item('Some Bank Statement', 40, 730)],
      header,
      [item('01/08/2026', 40, 680), item('UPI-SWIGGY ORDER', 110, 680), item('340.00', 330, 680), item('54,660.00', 510, 680)],
      [item('REF 8821 BANGALORE', 110, 668)], // narration wrap line
      [item('02/08/2026', 40, 650), item('NEFT SALARY', 110, 650), item('85,000.00', 420, 650), item('1,39,660.00', 510, 650)],
      [item('03/08/2026', 40, 630), item('BESCOM BILL', 110, 630), item('1,420.00', 330, 630), item('1,38,240.00', 510, 630)],
      [item('Statement Summary', 40, 600), item('Total Withdrawal 1,760.00', 200, 600)],
    ])
    const { transactions, skipped } = linesToTransactions(groupItemsToLines(items))
    expect(transactions).toHaveLength(2)
    expect(transactions[0]).toMatchObject({ date: '2026-08-01', amount: 340 })
    expect(transactions[0].description).toContain('SWIGGY')
    expect(transactions[0].description).toContain('REF 8821')
    expect(transactions[1]).toMatchObject({ date: '2026-08-03', amount: 1420 })
    expect(skipped).toBe(1) // the salary credit
  })

  it('uses running-balance delta when there is a single Amount column', () => {
    const items = page([
      [item('Date', 40, 700), item('Particulars', 110, 700), item('Amount', 380, 700), item('Balance', 510, 700)],
      // seed prevBalance via an unambiguous credit? no — first row: spent 340: 55,000 → 54,660 can't be classified without prev.
      [item('01/08/2026', 40, 680), item('OPENING SEED', 110, 680), item('55,000.00', 380, 680), item('55,000.00', 510, 680)],
      [item('02/08/2026', 40, 660), item('ZOMATO ORDER', 110, 660), item('340.00', 380, 660), item('54,660.00', 510, 660)],
      [item('03/08/2026', 40, 640), item('REFUND CREDIT', 110, 640), item('100.00', 380, 640), item('54,760.00', 510, 640)],
      [item('04/08/2026', 40, 620), item('UBER TRIP', 110, 620), item('260.00', 380, 620), item('54,500.00', 510, 620)],
    ])
    const { transactions } = linesToTransactions(groupItemsToLines(items))
    expect(transactions.map((t) => t.description)).toEqual(['ZOMATO ORDER', 'UBER TRIP'])
  })

  it('respects explicit Dr/Cr suffixes on amounts', () => {
    const items = page([
      [item('Txn Date', 40, 700), item('Details', 110, 700), item('Amount', 380, 700)],
      [item('01/08/2026', 40, 680), item('SWIGGY', 110, 680), item('340.00 Dr', 380, 680)],
      [item('02/08/2026', 40, 660), item('REFUND', 110, 660), item('120.00 Cr', 380, 660)],
    ])
    const { transactions, skipped } = linesToTransactions(groupItemsToLines(items))
    expect(transactions).toHaveLength(1)
    expect(transactions[0].description).toBe('SWIGGY')
    expect(skipped).toBe(1)
  })

  it('errors when no table header exists', () => {
    const { error } = linesToTransactions(groupItemsToLines([item('just a letter', 40, 700)]))
    expect(error).toBeTruthy()
  })
})
