import { useMemo, useState } from 'react'
import { Download, TrendingDown, TrendingUp } from 'lucide-react'
import { computeNetBalances, computeTotalSpent, fmtMoney, simplifyDebts } from '../lib/balances'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const today = new Date().toISOString().slice(0, 10)

export default function Insights({ me, members, expenses, settlements, currency }) {
  const memberIds = members.map((m) => m.id)
  const nameOf = (id) => members.find((m) => m.id === id)?.full_name || 'Someone'

  const [period, setPeriod] = useState('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const bounds = useMemo(() => {
    if (period === 'month') return { from: `${today.slice(0, 7)}-01`, to: today }
    if (period === 'three-months') return { from: monthStart(-2), to: today }
    if (period === 'custom') return { from: customFrom, to: customTo }
    return { from: '', to: '' }
  }, [period, customFrom, customTo])

  const filteredExpenses = useMemo(
    () => expenses.filter((e) => inDateRange(e.expense_date, bounds)),
    [expenses, bounds]
  )
  const filteredSettlements = useMemo(
    () => settlements.filter((s) => inDateRange(s.created_at?.slice(0, 10), bounds)),
    [settlements, bounds]
  )

  const total = filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0)
  const spent = computeTotalSpent(memberIds, filteredExpenses)
  const net = computeNetBalances(memberIds, filteredExpenses, filteredSettlements)
  const transfers = simplifyDebts(net)
  const monthly = useMemo(() => groupByMonth(filteredExpenses), [filteredExpenses])
  const categories = useMemo(() => groupByCategory(filteredExpenses), [filteredExpenses])
  const topExpenses = useMemo(
    () => [...filteredExpenses].sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 5),
    [filteredExpenses]
  )
  const maxMonth = Math.max(...monthly.map(([, value]) => value), 1)
  const maxCategory = Math.max(...categories.map(([, value]) => value), 1)
  const averageMonthly = monthly.length ? total / monthly.length : 0
  const topCategory = categories[0]
  const yourNet = net[me.id] ?? 0
  const pendingTotal = transfers.reduce((sum, transfer) => sum + transfer.amount, 0)
  const hasData = filteredExpenses.length > 0 || filteredSettlements.length > 0
  const periodLabel = period === 'month'
    ? 'This month'
    : period === 'three-months'
      ? 'Last 3 months'
      : period === 'custom'
        ? 'Custom range'
        : 'All time'

  function exportCsv() {
    const esc = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`
    const rows = [
      ['type', 'date', 'description', 'category', 'paid_by', 'amount', 'currency'],
      ...filteredExpenses.map((e) => [
        'expense', e.expense_date, e.description, e.category || '', nameOf(e.paid_by), Number(e.amount), currency,
      ]),
      ...filteredSettlements.map((s) => [
        'settlement', s.created_at.slice(0, 10), s.note || `${nameOf(s.from_user)} pays ${nameOf(s.to_user)}`, '', nameOf(s.from_user), Number(s.amount), currency,
      ]),
    ]
    const csv = rows.map((row) => row.map(esc).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `flatsplit-export-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="page insights-page">
      <section className="card insights-header">
        <div className="card-title-row">
          <div>
            <h2 className="card-title">Insights</h2>
            <p className="hint">See where the flat’s money is going and what needs settling.</p>
          </div>
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={!hasData}>
            <Download size={14} /> Export CSV
          </Button>
        </div>

        <div className="insights-filters">
          <label className="field insights-period-field">
            <Label htmlFor="insights-period">Period</Label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger id="insights-period"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All time</SelectItem>
                <SelectItem value="month">This month</SelectItem>
                <SelectItem value="three-months">Last 3 months</SelectItem>
                <SelectItem value="custom">Custom range</SelectItem>
              </SelectContent>
            </Select>
          </label>
          {period === 'custom' && (
            <>
              <label className="field">
                <Label htmlFor="insights-from">From</Label>
                <Input id="insights-from" type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              </label>
              <label className="field">
                <Label htmlFor="insights-to">To</Label>
                <Input id="insights-to" type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
              </label>
            </>
          )}
          <Badge variant="secondary" className="insights-period-badge">{periodLabel}</Badge>
        </div>
      </section>

      {!hasData ? (
        <section className="card">
          <div className="empty-state">
            <p className="empty">No expenses or payments in this period.</p>
            <p className="hint">Try All time or choose a wider custom range.</p>
          </div>
        </section>
      ) : (
        <>
          <section className="insights-summary">
            <StatCard label="Total spent" value={fmtMoney(total, currency)} detail={`${filteredExpenses.length} expense${filteredExpenses.length === 1 ? '' : 's'}`} />
            <StatCard label="Average per month" value={fmtMoney(averageMonthly, currency)} detail={`${monthly.length || 0} month${monthly.length === 1 ? '' : 's'} with spending`} />
            <StatCard label="Top category" value={topCategory ? topCategory[0] : '—'} detail={topCategory ? fmtMoney(topCategory[1], currency) : 'No categories'} />
            <StatCard label="Your balance" value={signedMoney(yourNet, currency)} detail={`paid ${fmtMoney(spent[me.id] ?? 0, currency)} · ${percent(spent[me.id] ?? 0, total)}%`} />
          </section>

          <section className="card">
            <div className="insight-section-heading">
              <div>
                <h2 className="card-title">Monthly spending</h2>
                <p className="hint">Actual totals by month, not just relative bars.</p>
              </div>
              <span className="money">{fmtMoney(total, currency)}</span>
            </div>
            <div className="insight-month-list">
              {monthly.length === 0 ? <p className="empty">No dated expenses in this period.</p> : monthly.map(([month, value]) => (
                <div className="insight-month-row" key={month}>
                  <span className="insight-month-label">{formatMonth(month)}</span>
                  <span className="insight-bar-track"><span className="insight-bar" style={{ width: `${(value / maxMonth) * 100}%` }} /></span>
                  <span className="money">{fmtMoney(value, currency)}</span>
                </div>
              ))}
            </div>
          </section>

          <div className="insights-columns">
            <section className="card">
              <div className="insight-section-heading">
                <div>
                  <h2 className="card-title">Where it goes</h2>
                  <p className="hint">Category share of group spending.</p>
                </div>
              </div>
              {categories.length === 0 ? <p className="empty">Nothing categorised yet.</p> : (
                <ul className="insight-rows">
                  {categories.map(([category, value]) => (
                    <li key={category} className="insight-row">
                      <span className="insight-label">{category}</span>
                      <span className="insight-bar-track"><span className="insight-bar" style={{ width: `${(value / maxCategory) * 100}%` }} /></span>
                      <span className="insight-value"><strong>{fmtMoney(value, currency)}</strong><small>{percent(value, total)}%</small></span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card">
              <div className="insight-section-heading">
                <div>
                  <h2 className="card-title">Settlement snapshot</h2>
                  <p className="hint">Payments recorded in this period.</p>
                </div>
              </div>
              <div className="settlement-stats">
                <div><span className="insight-stat-label">Recorded</span><strong className="money">{fmtMoney(filteredSettlements.reduce((sum, s) => sum + Number(s.amount), 0), currency)}</strong></div>
                <div><span className="insight-stat-label">Payments</span><strong>{filteredSettlements.length}</strong></div>
                <div><span className="insight-stat-label">Still pending</span><strong className={pendingTotal ? 'money neg' : 'money pos'}>{fmtMoney(pendingTotal, currency)}</strong></div>
              </div>
              {transfers.length === 0 ? <p className="insight-callout positive">Everyone is settled for this period.</p> : (
                <ul className="mini-transfer-list">
                  {transfers.slice(0, 3).map((transfer, index) => (
                    <li key={`${transfer.from}-${transfer.to}-${index}`}>
                      <span>{nameOf(transfer.from)} pays {nameOf(transfer.to)}</span>
                      <span className="money">{fmtMoney(transfer.amount, currency)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className="card">
            <div className="insight-section-heading">
              <div>
                <h2 className="card-title">Largest expenses</h2>
                <p className="hint">The bills that move the balance most.</p>
              </div>
            </div>
            <ul className="top-expense-list">
              {topExpenses.map((expense) => (
                <li key={expense.id} className="top-expense-row">
                  <span className="top-expense-icon">{expense.category?.slice(0, 1) || '₹'}</span>
                  <span className="top-expense-info"><strong>{expense.description}</strong><small>{formatDate(expense.expense_date)} · {nameOf(expense.paid_by)} paid{expense.category ? ` · ${expense.category}` : ''}</small></span>
                  <span className="money">{fmtMoney(expense.amount, currency)}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card">
            <div className="insight-section-heading">
              <div>
                <h2 className="card-title">People</h2>
                <p className="hint">Paid versus owed in the selected period.</p>
              </div>
            </div>
            <ul className="people-insight-list">
              {members.map((member) => {
                const paid = spent[member.id] ?? 0
                const balance = net[member.id] ?? 0
                return (
                  <li key={member.id} className="people-insight-row">
                    <span className="people-insight-name"><strong>{member.full_name}</strong>{member.id === me.id && <Badge variant="secondary">you</Badge>}</span>
                    <span className="people-insight-paid">paid {fmtMoney(paid, currency)} · {percent(paid, total)}%</span>
                    <span className={`money ${balance > 0.009 ? 'pos' : balance < -0.009 ? 'neg' : 'zero'}`}>
                      {balance > 0.009 ? <TrendingUp size={14} /> : balance < -0.009 ? <TrendingDown size={14} /> : null}
                      {balance > 0.009 ? '+' : balance < -0.009 ? '−' : ''}{fmtMoney(balance, currency)}
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

function StatCard({ label, value, detail }) {
  return (
    <article className="insight-stat-card">
      <span className="insight-stat-label">{label}</span>
      <strong className="insight-stat-value">{value}</strong>
      <span className="insight-stat-detail">{detail}</span>
    </article>
  )
}

function groupByMonth(expenses) {
  const totals = {}
  for (const expense of expenses) {
    const month = expense.expense_date?.slice(0, 7)
    if (month) totals[month] = (totals[month] || 0) + Number(expense.amount)
  }
  return Object.entries(totals).sort((a, b) => b[0].localeCompare(a[0]))
}

function groupByCategory(expenses) {
  const totals = {}
  for (const expense of expenses) {
    const category = expense.category || 'Other'
    totals[category] = (totals[category] || 0) + Number(expense.amount)
  }
  return Object.entries(totals).sort((a, b) => b[1] - a[1])
}

function inDateRange(date, bounds) {
  if (!date) return false
  return (!bounds.from || date >= bounds.from) && (!bounds.to || date <= bounds.to)
}

function monthStart(offset) {
  const date = new Date()
  date.setDate(1)
  date.setMonth(date.getMonth() + offset)
  return date.toISOString().slice(0, 10)
}

function percent(value, total) {
  return total > 0 ? Math.round((value / total) * 100) : 0
}

function signedMoney(value, currency) {
  if (value > 0.009) return `+${fmtMoney(value, currency)}`
  if (value < -0.009) return `−${fmtMoney(value, currency)}`
  return fmtMoney(0, currency)
}

function formatMonth(ym) {
  const [year, month] = ym.split('-')
  return `${MONTHS[Number(month) - 1].slice(0, 3)} ${year}`
}

function formatDate(value) {
  if (!value) return 'Unknown date'
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
