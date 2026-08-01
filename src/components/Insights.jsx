import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { computeTotalSpent, computeNetBalances, fmtMoney } from '../lib/balances'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export default function Insights({ me, members, expenses, settlements, currency }) {
  const memberIds = members.map((m) => m.id)
  const nameOf = (id) => members.find((m) => m.id === id)?.full_name || 'Someone'

  const months = useMemo(() => {
    const set = new Set()
    for (const e of expenses) {
      if (e.expense_date) set.add(e.expense_date.slice(0, 7))
    }
    for (const s of settlements) {
      if (s.created_at) set.add(s.created_at.slice(0, 7))
    }
    return [...set].sort().reverse()
  }, [expenses, settlements])

  const [range, setRange] = useState({ from: months.length ? `${months[months.length - 1]}-01` : '', to: '' })
  const [month, setMonth] = useState('all')

  const filteredExpenses = useMemo(() => {
    let list = expenses
    if (month !== 'all') {
      list = list.filter((e) => e.expense_date?.slice(0, 7) === month)
    }
    if (range.from) list = list.filter((e) => e.expense_date >= range.from)
    if (range.to) list = list.filter((e) => e.expense_date <= range.to)
    return list
  }, [expenses, month, range])

  const filteredSettlements = useMemo(() => {
    if (month === 'all' && !range.from && !range.to) return settlements
    return settlements.filter((s) => {
      const d = s.created_at.slice(0, 10)
      const inMonth = month === 'all' || d.slice(0, 7) === month
      const inRange = (!range.from || d >= range.from) && (!range.to || d <= range.to)
      return inMonth && inRange
    })
  }, [settlements, month, range])

  const total = filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0)
  const net = computeNetBalances(memberIds, filteredExpenses, filteredSettlements)
  const spent = computeTotalSpent(memberIds, filteredExpenses)

  const categories = useMemo(() => {
    const map = {}
    for (const e of filteredExpenses) {
      const c = e.category || 'Other'
      map[c] = (map[c] || 0) + Number(e.amount)
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [filteredExpenses])

  const byMonth = useMemo(() => {
    const map = {}
    for (const e of expenses) {
      const m = e.expense_date?.slice(0, 7)
      if (!m) continue
      if (range.from && e.expense_date < range.from) continue
      if (range.to && e.expense_date > range.to) continue
      map[m] = (map[m] || 0) + Number(e.amount)
    }
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]))
  }, [expenses, range])

  const maxMonth = Math.max(...byMonth.map(([, v]) => v), 1)
  const maxCat = Math.max(...categories.map(([, v]) => v), 1)

  function label(ym) {
    const [y, m] = ym.split('-')
    return `${MONTHS[Number(m) - 1].slice(0, 3)} ${y}`
  }

  function exportCsv() {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const rows = [
      ['type', 'date', 'description', 'category', 'paid_by', 'amount', 'currency'],
      ...filteredExpenses.map((e) => [
        'expense', e.expense_date, e.description, e.category || '', nameOf(e.paid_by), Number(e.amount), currency,
      ]),
      ...filteredSettlements.map((s) => [
        'settlement', s.created_at.slice(0, 10), s.note || `${nameOf(s.from_user)} pays ${nameOf(s.to_user)}`, '', nameOf(s.from_user), Number(s.amount), currency,
      ]),
    ]
    const csv = rows.map((r) => r.map(esc).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `flatsplit-export-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const hasData = filteredExpenses.length > 0 || filteredSettlements.length > 0

  return (
    <div className="page">
      <section className="card">
        <div className="card-title-row">
          <h2 className="card-title">Insights</h2>
          <button className="btn ghost small" onClick={exportCsv} disabled={!hasData}>
            <Download size={14} /> Export CSV
          </button>
        </div>

        <div className="field-row">
          <label className="field">
            <span>Month</span>
            <select value={month} onChange={(e) => setMonth(e.target.value)}>
              <option value="all">All months</option>
              {months.map((m) => (
                <option key={m} value={m}>{label(m)}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>From</span>
            <input type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
          </label>
          <label className="field">
            <span>To</span>
            <input type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
          </label>
        </div>
      </section>

      {!hasData ? (
        <section className="card">
          <p className="empty">No expenses in this period yet. Add a few and your insights will show up here.</p>
        </section>
      ) : (
        <>
          <section className="card">
            <h2 className="card-title">Monthly spending</h2>
            <div className="bars">
              {byMonth.map(([m, v]) => (
                <div key={m} className="bar-col" title={`${label(m)}: ${fmtMoney(v, currency)}`}>
                  <span className="bar" style={{ height: `${Math.max(6, (v / maxMonth) * 100)}%` }} />
                  <span className="bar-label">{label(m)}</span>
                </div>
              ))}
            </div>
            <p className="totals-row">
              <span className="totals-label">Total this period</span>
              <span className="money">{fmtMoney(total, currency)}</span>
            </p>
          </section>

          <section className="card">
            <h2 className="card-title">By category</h2>
            {categories.length === 0 ? (
              <p className="empty">Nothing categorised in this period.</p>
            ) : (
              <ul className="insight-rows">
                {categories.map(([c, v]) => (
                  <li key={c} className="insight-row">
                    <span className="insight-label">{c}</span>
                    <span className="insight-bar-track">
                      <span className="insight-bar" style={{ width: `${(v / maxCat) * 100}%` }} />
                    </span>
                    <span className="money">{fmtMoney(v, currency)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <h2 className="card-title">Per person</h2>
            <ul className="ledger">
              {members.map((m) => {
                const v = net[m.id] ?? 0
                return (
                  <li key={m.id} className="ledger-row">
                    <span className="ledger-name">
                      {m.full_name}
                      {m.id === me.id && <em className="you-tag">you</em>}
                      <em className="activity-meta">paid {fmtMoney(spent[m.id] ?? 0, currency)}</em>
                    </span>
                    <span className={`money ${v > 0.009 ? 'pos' : v < -0.009 ? 'neg' : 'zero'}`}>
                      {v > 0.009 ? '+' : v < -0.009 ? '\u2212' : ''}{fmtMoney(v, currency)}
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        </>
      )}
    </div>
  )
}
