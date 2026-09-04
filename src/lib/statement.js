// Bank statement CSV parsing — fully client-side. The file never leaves
// the device; we only extract debit transactions for the user to review.

// Minimal CSV parser: quoted fields, commas inside quotes, CR/LF.
export function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') inQuotes = false
      else cell += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell); cell = ''
      rows.push(row); row = []
    } else cell += ch
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

const DATE_HEADERS = ['transaction date', 'txn date', 'value date', 'date', 'tran date']
const DESC_HEADERS = ['narration', 'description', 'particulars', 'details', 'remarks', 'transaction remarks']
const DEBIT_HEADERS = ['withdrawal amt', 'withdrawal', 'debit amount', 'debit amt', 'debit', 'dr amount']
const CREDIT_HEADERS = ['deposit amt', 'deposit', 'credit amount', 'credit amt', 'credit', 'cr amount']
const AMOUNT_HEADERS = ['amount (inr)', 'transaction amount', 'amount', 'amt']
const TYPE_HEADERS = ['dr/cr', 'cr/dr', 'type', 'transaction type', 'dr / cr']

function findCol(header, names) {
  const lower = header.map((h) => h.trim().toLowerCase())
  for (const name of names) {
    const idx = lower.findIndex((h) => h === name || h.startsWith(name))
    if (idx !== -1) return idx
  }
  return -1
}

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 }

// Accepts DD/MM/YYYY, DD-MM-YY, YYYY-MM-DD, "01 Aug 2026", "01-Aug-26" → ISO date or null.
export function parseStatementDate(raw) {
  const t = String(raw || '').trim()
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (m) {
    const [, d, mo, yRaw] = m
    const y = yRaw.length === 2 ? `20${yRaw}` : yRaw
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }
  m = t.match(/^(\d{1,2})[ -]([A-Za-z]{3})[A-Za-z]*[ -](\d{2,4})$/)
  if (m) {
    const [, d, moName, yRaw] = m
    const mo = MONTHS[moName.slice(0, 3).toLowerCase()]
    if (mo === undefined) return null
    const y = yRaw.length === 2 ? `20${yRaw}` : yRaw
    return `${y}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }
  return null
}

export function parseAmount(raw) {
  const cleaned = String(raw || '').replace(/[₹,\s]/g, '').replace(/(inr|rs\.?)/i, '')
  if (cleaned === '' || cleaned === '-') return null
  const n = Number(cleaned.replace(/[()]/g, ''))
  if (Number.isNaN(n)) return null
  return /^\(.*\)$/.test(String(raw).trim()) ? -Math.abs(n) : n
}

// Returns { transactions: [{date, description, amount}], skipped } — debits only.
export function extractTransactions(csvText) {
  const rows = parseCsv(csvText)
  // Header row = first row that has both a date-ish and an amount-ish column
  // (banks prepend account info lines).
  let headerIdx = -1
  let cols = null
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const dateCol = findCol(rows[i], DATE_HEADERS)
    const debitCol = findCol(rows[i], DEBIT_HEADERS)
    const amountCol = findCol(rows[i], AMOUNT_HEADERS)
    if (dateCol !== -1 && (debitCol !== -1 || amountCol !== -1)) {
      headerIdx = i
      cols = {
        date: dateCol,
        desc: findCol(rows[i], DESC_HEADERS),
        debit: debitCol,
        credit: findCol(rows[i], CREDIT_HEADERS),
        amount: amountCol,
        type: findCol(rows[i], TYPE_HEADERS),
      }
      break
    }
  }
  if (headerIdx === -1) return { transactions: [], skipped: 0, error: 'Could not find a header row with date and amount columns.' }

  const transactions = []
  let skipped = 0
  for (const r of rows.slice(headerIdx + 1)) {
    const date = parseStatementDate(r[cols.date])
    if (!date) { skipped++; continue }
    const description = (cols.desc !== -1 ? r[cols.desc] : '').trim() || 'Bank transaction'
    let amount = null
    if (cols.debit !== -1) {
      const d = parseAmount(r[cols.debit])
      if (d && d > 0) amount = d
      else { skipped++; continue } // credit row or empty debit
    } else {
      const a = parseAmount(r[cols.amount])
      if (a === null || a === 0) { skipped++; continue }
      const typeVal = cols.type !== -1 ? String(r[cols.type]).trim().toLowerCase() : null
      if (typeVal) {
        if (typeVal.startsWith('cr')) { skipped++; continue }
        amount = Math.abs(a)
      } else if (a < 0) amount = Math.abs(a) // signed: negative = spent
      else { skipped++; continue } // unsigned single amount without type: can't tell, skip credits-safe
    }
    transactions.push({ date, description, amount: Math.round(amount * 100) / 100 })
  }
  return { transactions, skipped }
}

// Stable content hash for dedup on re-import (djb2, hex).
export function txnHash(t) {
  const str = `${t.date}|${t.amount.toFixed(2)}|${t.description.toLowerCase().replace(/\s+/g, ' ').trim()}`
  let h = 5381
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0
  return h.toString(16).padStart(8, '0') + '-' + str.length.toString(16)
}
