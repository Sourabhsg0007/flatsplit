import { useRef, useState } from 'react'
import { FileUp, ShieldCheck, X } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { extractTransactions, txnHash } from '../lib/statement'
import { classifyAll } from '../lib/classify'
import { fmtMoney } from '../lib/balances'
import { useToast } from './Toast'
import { Button } from './ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'

const CATEGORIES = [
  'Food & Groceries', 'Rent', 'Utilities', 'Transportation',
  'Entertainment', 'Shopping', 'Health', 'Subscriptions', 'Other',
]

// A believable month so people can feel the feature without a real file.
const SAMPLE_CSV = `Account Statement,,,,,
Account No,XXXX1234,,,,
Txn Date,Narration,Ref No,Withdrawal Amt,Deposit Amt,Balance
01/08/2026,UPI-SWIGGY-ORDER 8821,882101,340.00,,54660.00
01/08/2026,NEFT SALARY AUG TECHCORP,SAL0801,,85000.00,139660.00
02/08/2026,UPI-BLINKIT GROCERIES,772201,645.50,,139014.50
03/08/2026,ACH-NETFLIX SUBSCRIPTION,NFX801,649.00,,138365.50
04/08/2026,UPI-UBER TRIP KORAMANGALA,UBR441,284.00,,138081.50
05/08/2026,POS AMAZON RETAIL,AMZ118,2149.00,,135932.50
07/08/2026,UPI-ZOMATO ORDER 9912,991201,520.00,,135412.50
08/08/2026,UPI-RAPIDO BIKE,RPD102,96.00,,135316.50
08/08/2026,UPI-BOOKMYSHOW PVR TICKETS,BMS330,900.00,,134416.50
09/08/2026,UPI-CHAI POINT HSR,CHP221,120.00,,134296.50
10/08/2026,BESCOM ELECTRICITY BILL,BES801,1420.00,,132876.50
11/08/2026,UPI-ZEPTO INSTANT,ZPT551,412.00,,132464.50
12/08/2026,ACH-SPOTIFY PREMIUM,SPT801,119.00,,132345.50
13/08/2026,UPI-SWIGGY-ORDER 9101,910101,385.00,,131960.50
15/08/2026,UPI-MYNTRA FASHION,MYN808,1799.00,,130161.50
16/08/2026,UPI-PVR INOX SNACKS,PVR119,460.00,,129701.50
17/08/2026,UPI-OLA CABS AIRPORT,OLA662,612.00,,129089.50
18/08/2026,UPI-APOLLO PHARMACY,APL220,368.00,,128721.50
19/08/2026,UPI-DOMINOS PIZZA,DOM314,559.00,,128162.50
21/08/2026,ACT FIBERNET BROADBAND,ACT801,1180.00,,126982.50
22/08/2026,UPI-BIGBASKET MONTHLY,BBK667,2260.00,,124722.50
23/08/2026,UPI-ZOMATO ORDER 9955,995501,430.00,,124292.50
24/08/2026,UPI-CULT.FIT MEMBERSHIP,CLT801,999.00,,123293.50
26/08/2026,POS DECATHLON SPORTS,DCT445,1340.00,,121953.50
28/08/2026,UPI-SWIGGY-ORDER 9330,933001,295.00,,121658.50
29/08/2026,UPI-BLINKIT GROCERIES,772299,530.00,,121128.50
30/08/2026,UPI-UBER TRIP INDIRANAGAR,UBR559,342.00,,120786.50
`

// Everything here happens on-device: the file is read in the browser,
// parsed in the browser, and only rows the user ticks are saved.
export default function ImportStatement({ me, currency, onImported, onClose }) {
  const [rows, setRows] = useState(null) // [{date, description, amount, category, checked}]
  const [skipped, setSkipped] = useState(0)
  const [parseError, setParseError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [pdfPassword, setPdfPassword] = useState('')
  const [needsPassword, setNeedsPassword] = useState(false)
  const [wrongPassword, setWrongPassword] = useState(false)
  const pdfBufferRef = useRef(null)
  const fileRef = useRef(null)
  const toast = useToast()

  function loadText(text) {
    setParseError(null)
    const { transactions, skipped: sk, error } = extractTransactions(text)
    if (error || transactions.length === 0) {
      setParseError(error || 'No debit transactions found in that file.')
      setRows(null)
      return
    }
    setRows(classifyAll(transactions).map((t) => ({ ...t, checked: true })))
    setSkipped(sk)
  }

  function applyResult(result) {
    setParsing(false)
    if (result.needsPassword) {
      setNeedsPassword(true)
      setWrongPassword(!!result.wrongPassword && pdfPassword !== '')
      return
    }
    pdfBufferRef.current = null
    setNeedsPassword(false)
    setPdfPassword('')
    if (result.error || result.transactions.length === 0) {
      setParseError(result.error || 'No debit transactions found in that file.')
      setRows(null)
      return
    }
    setRows(classifyAll(result.transactions).map((t) => ({ ...t, checked: true })))
    setSkipped(result.skipped)
  }

  async function parsePdf(buffer, password) {
    setParsing(true)
    setParseError(null)
    try {
      // pdf.js is heavy — only loaded when someone actually picks a PDF
      const { parsePdfStatement } = await import('../lib/pdfStatement')
      applyResult(await parsePdfStatement(buffer, password))
    } catch {
      setParsing(false)
      setParseError('Could not read that PDF.')
    }
  }

  async function onFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setParseError(null)
    setNeedsPassword(false)
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
      pdfBufferRef.current = await file.arrayBuffer()
      await parsePdf(pdfBufferRef.current.slice(0), '')
    } else {
      loadText(await file.text())
    }
    e.target.value = ''
  }

  function setRow(idx, patch) {
    setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  const selected = (rows || []).filter((r) => r.checked)
  const selectedTotal = selected.reduce((s, r) => s + r.amount, 0)

  async function importSelected() {
    if (!selected.length) return
    setBusy(true)
    const payload = selected.map((r) => ({
      user_id: me.id,
      description: r.description.slice(0, 120),
      amount: r.amount,
      category: r.category,
      expense_date: r.date,
      source: 'import',
      import_hash: txnHash(r),
    }))
    const { data, error } = await supabase
      .from('personal_expenses')
      .upsert(payload, { onConflict: 'user_id,import_hash', ignoreDuplicates: true })
      .select('id')
    setBusy(false)
    if (error) { toast('error', error.message); return }
    const inserted = data ? data.length : payload.length
    const dupes = payload.length - inserted
    toast('success', dupes > 0
      ? `Imported ${inserted} expense${inserted === 1 ? '' : 's'} (${dupes} already imported earlier).`
      : `Imported ${inserted} expense${inserted === 1 ? '' : 's'}.`)
    onImported()
    onClose()
  }

  return (
    <section className="card import-card">
      <div className="import-head">
        <h2 className="card-title">Import bank statement</h2>
        <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close import">
          <X size={16} />
        </Button>
      </div>

      <p className="hint import-privacy">
        <ShieldCheck size={14} /> The file is read and categorised on your device — it&rsquo;s never
        uploaded. Only the rows you tick get saved, as private personal expenses.
      </p>

      {!rows && (
        <>
          <p className="hint">
            Export a <strong>CSV or PDF</strong> statement from your bank&rsquo;s netbanking
            (HDFC, ICICI, SBI, Axis, Kotak layouts are auto-detected; scanned PDFs won&rsquo;t work).
            Only money going <em>out</em> is picked up; salary credits are ignored.
          </p>
          <div className="import-actions">
            <Button onClick={() => fileRef.current?.click()} disabled={parsing}>
              <FileUp size={15} /> {parsing ? 'Reading PDF…' : 'Choose CSV or PDF'}
            </Button>
            <Button variant="outline" onClick={() => loadText(SAMPLE_CSV)} disabled={parsing}>
              Try with a sample statement
            </Button>
          </div>
          <input ref={fileRef} type="file" accept=".csv,text/csv,.pdf,application/pdf" onChange={onFile} hidden />
          {needsPassword && (
            <div className="pdf-password">
              <p className="hint">{wrongPassword ? 'That password didn\u2019t open it — try again.' : 'This PDF is password-protected (banks usually use your customer ID or date of birth — the email from the bank says which).'}</p>
              <div className="field-row">
                <input
                  className="ui-input"
                  type="password"
                  value={pdfPassword}
                  placeholder="PDF password"
                  onChange={(e) => setPdfPassword(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && pdfPassword) parsePdf(pdfBufferRef.current.slice(0), pdfPassword) }}
                />
                <Button onClick={() => parsePdf(pdfBufferRef.current.slice(0), pdfPassword)} disabled={!pdfPassword || parsing}>
                  {parsing ? 'Opening…' : 'Unlock'}
                </Button>
              </div>
              <p className="hint">The password is used on your device only to open the file — it isn&rsquo;t stored or sent anywhere.</p>
            </div>
          )}
          {parseError && <p className="form-error">{parseError}</p>}
        </>
      )}

      {rows && (
        <>
          <p className="hint">
            Found <strong>{rows.length}</strong> spends{skipped > 0 ? ` (${skipped} credit/blank rows ignored)` : ''}.
            Categories are auto-guessed — fix any that look wrong, untick what you don&rsquo;t want.
          </p>
          <ul className="import-list">
            {rows.map((r, i) => (
              <li key={i} className={`import-row ${r.checked ? '' : 'import-row-off'}`}>
                <input
                  type="checkbox"
                  checked={r.checked}
                  onChange={(e) => setRow(i, { checked: e.target.checked })}
                  aria-label={`Include ${r.description}`}
                />
                <span className="import-desc">
                  <span className="import-name">{r.description}</span>
                  <span className="import-date">{r.date}</span>
                </span>
                <Select value={r.category} onValueChange={(v) => setRow(i, { category: v })}>
                  <SelectTrigger className="import-cat"><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
                <span className="money">{fmtMoney(r.amount, currency)}</span>
              </li>
            ))}
          </ul>
          <div className="import-footer">
            <span className="hint">{selected.length} selected · <span className="money">{fmtMoney(selectedTotal, currency)}</span></span>
            <div className="import-actions">
              <Button variant="outline" onClick={() => { setRows(null); setParseError(null) }}>Back</Button>
              <Button onClick={importSelected} disabled={busy || selected.length === 0}>
                {busy ? 'Importing…' : `Import ${selected.length}`}
              </Button>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
