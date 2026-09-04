// Pure logic for turning positioned PDF text items into transactions.
// No pdf.js imports here so it's unit-testable and reusable in Node.
//
// Bank statement PDFs are tables of positioned text, not structured data.
// Strategy:
//   1. Group text items into visual lines by y-coordinate.
//   2. Find the header line to learn the x-position of each column
//      (withdrawal/debit, deposit/credit, balance, amount).
//   3. A line starting with a date is a transaction; numeric cells are
//      assigned to columns by nearest header x. Debits are kept.
//   4. Lines with no date and no numbers are narration continuations —
//      appended to the previous transaction's description.
//   5. When columns are ambiguous, the running-balance delta decides
//      whether an amount was money in or money out.

import { parseStatementDate } from './statement.js'

// items: [{ str, x, y }] for one page → lines: [{ y, cells: [{x, str}] }]
export function groupItemsToLines(items, yTolerance = 2.5) {
  const lines = []
  const sorted = [...items]
    .filter((it) => it.str && it.str.trim() !== '')
    .sort((a, b) => b.y - a.y || a.x - b.x) // top → bottom, left → right
  for (const it of sorted) {
    const line = lines.find((l) => Math.abs(l.y - it.y) <= yTolerance)
    if (line) {
      line.cells.push({ x: it.x, str: it.str.trim() })
      line.y = (line.y + it.y) / 2
    } else {
      lines.push({ y: it.y, cells: [{ x: it.x, str: it.str.trim() }] })
    }
  }
  for (const l of lines) l.cells.sort((a, b) => a.x - b.x)
  return lines
}

const AMOUNT_RE = /^-?(?:₹\s*)?[\d,]+\.\d{2}\s*(?:cr|dr)?$/i
const DATE_HEAD = ['date', 'txn date', 'transaction date', 'value date', 'tran date']
const DEBIT_HEAD = ['withdrawal', 'debit', 'dr amount', 'paid out']
const CREDIT_HEAD = ['deposit', 'credit', 'cr amount', 'paid in']
const BALANCE_HEAD = ['balance', 'closing balance']
const AMOUNT_HEAD = ['amount']
const STOP_WORDS = ['statement summary', 'closing balance for', 'opening balance', 'total withdrawal', 'total debit', 'end of statement', 'grand total', 'transaction total', 'legends', 'this is a computer generated']

function cleanAmount(str) {
  const isCr = /cr\s*$/i.test(str)
  const isDr = /dr\s*$/i.test(str)
  const n = Number(str.replace(/[₹,\s]/g, '').replace(/(cr|dr)$/i, ''))
  if (Number.isNaN(n)) return null
  return { value: Math.abs(n), signed: n, isCr, isDr }
}

function headerX(cells, names) {
  for (const c of cells) {
    const t = c.str.toLowerCase()
    for (const n of names) if (t.includes(n)) return c.x
  }
  return null
}

export function linesToTransactions(allLines) {
  // find the header line: has a date-ish word and at least one money column word
  let header = null
  for (const line of allLines) {
    const joined = line.cells.map((c) => c.str.toLowerCase()).join(' | ')
    const hasDate = DATE_HEAD.some((h) => joined.includes(h))
    const hasMoney = [...DEBIT_HEAD, ...CREDIT_HEAD, ...AMOUNT_HEAD].some((h) => joined.includes(h))
    if (hasDate && hasMoney) {
      header = {
        debitX: headerX(line.cells, DEBIT_HEAD),
        creditX: headerX(line.cells, CREDIT_HEAD),
        balanceX: headerX(line.cells, BALANCE_HEAD),
        amountX: headerX(line.cells, AMOUNT_HEAD),
        y: line.y,
      }
      break
    }
  }
  if (!header) return { transactions: [], skipped: 0, error: 'Could not find the transaction table header in this PDF.' }

  const transactions = []
  let skipped = 0
  let prevBalance = null
  let stopped = false

  for (const line of allLines) {
    if (stopped) break
    const text = line.cells.map((c) => c.str).join(' ')
    const lower = text.toLowerCase()
    if (STOP_WORDS.some((w) => lower.includes(w))) { stopped = transactions.length > 0; continue }

    const first = line.cells[0]
    const date = first ? parseStatementDate(first.str) : null
    const amountCells = line.cells
      .filter((c) => AMOUNT_RE.test(c.str))
      .map((c) => Object.assign(c, { parsed: cleanAmount(c.str) }))
      .filter((c) => c.parsed)
    const amountSet = new Set(amountCells)

    if (!date) {
      // narration continuation: text-only line between transactions
      if (amountCells.length === 0 && transactions.length > 0 && line.y < header.y) {
        const last = transactions[transactions.length - 1]
        const extra = text.trim()
        if (extra && last.description.length < 110) last.description = `${last.description} ${extra}`.slice(0, 120)
      }
      continue
    }
    if (amountCells.length === 0) continue

    // balance = amount cell nearest the balance column (or right-most cell)
    let balanceCell = null
    if (header.balanceX != null) {
      balanceCell = amountCells.reduce((best, c) =>
        Math.abs(c.x - header.balanceX) < Math.abs((best?.x ?? Infinity) - header.balanceX) ? c : best, null)
      if (balanceCell && Math.abs(balanceCell.x - header.balanceX) > 60) balanceCell = null
    }
    const moneyCells = amountCells.filter((c) => c !== balanceCell)
    if (moneyCells.length === 0) { prevBalance = balanceCell?.parsed.value ?? prevBalance; skipped++; continue }

    // pick the transaction amount cell and decide debit vs credit
    let amount = null
    const near = (c, x) => x != null && Math.abs(c.x - x) <= 60
    const debitCell = moneyCells.find((c) => near(c, header.debitX))
    const creditCell = moneyCells.find((c) => near(c, header.creditX))

    if (debitCell && debitCell.parsed.value > 0) amount = debitCell.parsed.value
    else if (creditCell) { prevBalance = balanceCell?.parsed.value ?? prevBalance; skipped++; continue }
    else {
      const cell = moneyCells[0]
      const { value, signed, isCr, isDr } = cell.parsed
      if (isDr) amount = value
      else if (isCr) { prevBalance = balanceCell?.parsed.value ?? prevBalance; skipped++; continue }
      else if (signed < 0) amount = value
      else if (balanceCell && prevBalance != null) {
        // running-balance delta decides direction
        const newBal = balanceCell.parsed.value
        if (Math.abs(prevBalance - value - newBal) < 0.02) amount = value // money out
        else { prevBalance = newBal; skipped++; continue } // money in
      } else {
        prevBalance = balanceCell?.parsed.value ?? prevBalance
        skipped++
        continue // can't tell — stay credit-safe
      }
    }

    prevBalance = balanceCell?.parsed.value ?? prevBalance

    // description = non-amount cells after the date cell
    const description = line.cells
      .filter((c) => c !== first && !amountSet.has(c))
      .map((c) => c.str)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim() || 'Bank transaction'

    transactions.push({ date, description: description.slice(0, 120), amount: Math.round(amount * 100) / 100 })
  }

  return { transactions, skipped }
}
