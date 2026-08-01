import { useState } from 'react'
import { computeNetBalances, computeTotalSpent, computeTotalGroupExpenses, simplifyDebts, fmtMoney } from '../lib/balances'

export default function Balances({ me, members, expenses, settlements, currency, onGoSettle, onAddExpense }) {
  const [expandedSpender, setExpandedSpender] = useState(null)
  const memberIds = members.map((m) => m.id)
  const net = computeNetBalances(memberIds, expenses, settlements)
  const totals = computeTotalSpent(memberIds, expenses)
  const totalExpenses = computeTotalGroupExpenses(expenses)
  const transfers = simplifyDebts(net)
  const myNet = net[me.id] ?? 0
  const nameOf = (id) => members.find((m) => m.id === id)?.full_name || 'Someone'
  const allSettled = transfers.length === 0

  if (expenses.length === 0 && settlements.length === 0) {
    return (
      <div className="page">
        <section className="hero-balance even">
          <span className="hero-label">You are</span>
          <span className="hero-amount">all square</span>
        </section>
        <section className="card">
          <div className="empty-state">
            <p className="empty">
              No expenses yet. Split your first bill and balances will appear here.
            </p>
            <button className="btn primary block" onClick={onAddExpense}>
              Add your first expense
            </button>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="page">
      <section className={`hero-balance ${myNet > 0.009 ? 'up' : myNet < -0.009 ? 'down' : 'even'}`}>
        <span className="hero-label">
          {myNet > 0.009 ? 'You are owed' : myNet < -0.009 ? 'You owe' : 'You are'}
        </span>
        <span className="hero-amount">
          {Math.abs(myNet) < 0.009 ? 'all square' : fmtMoney(myNet, currency)}
        </span>
      </section>

      <section className="card">
        <h2 className="card-title">Total group expenses</h2>
        <p className="totals-row">
          <span className="totals-label">Overall spending</span>
          <span className="money">{fmtMoney(totalExpenses, currency)}</span>
        </p>
      </section>

      <section className="card">
        <h2 className="card-title">Spent by each person</h2>
        <ul className="ledger">
          {members.map((m) => {
            const spent = totals[m.id] ?? 0
            const share = totalExpenses > 0 ? ((spent / totalExpenses) * 100).toFixed(0) : 0
            const paidExpenses = expenses
              .filter((expense) => expense.paid_by === m.id)
              .sort((a, b) => `${b.expense_date}${b.created_at}`.localeCompare(`${a.expense_date}${a.created_at}`))
            const isExpanded = expandedSpender === m.id
            return (
              <li key={m.id} className="person-spend-item">
                <button
                  type="button"
                  className="ledger-row person-spend-toggle"
                  onClick={() => setExpandedSpender(isExpanded ? null : m.id)}
                  aria-expanded={isExpanded}
                >
                  <span className="ledger-name">
                    {m.full_name}
                    {m.id === me.id && <em className="you-tag">you</em>}
                  </span>
                  <span className="money">{fmtMoney(spent, currency)} <span className="pct">({share}%)</span></span>
                </button>
                {isExpanded && (
                  <div className="person-expenses">
                    {paidExpenses.length === 0 ? (
                      <p className="empty">No expenses paid by {m.full_name} yet.</p>
                    ) : (
                      <ul className="person-expense-list">
                        {paidExpenses.map((expense) => (
                          <li key={expense.id} className="person-expense-row">
                            <span className="person-expense-info">
                              <span className="activity-desc">{expense.description}</span>
                              <span className="activity-meta">
                                {formatExpenseDate(expense.expense_date)}
                                {expense.category ? ` · ${expense.category}` : ''}
                              </span>
                            </span>
                            <span className="money">{fmtMoney(expense.amount, currency)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      <section className="card">
        <h2 className="card-title">Net balances</h2>
        <ul className="ledger">
          {members.map((m) => {
            const v = net[m.id] ?? 0
            return (
              <li key={m.id} className="ledger-row">
                <span className="ledger-name">
                  {m.full_name}
                  {m.id === me.id && <em className="you-tag">you</em>}
                </span>
                <span className={`money ${v > 0.009 ? 'pos' : v < -0.009 ? 'neg' : 'zero'}`}>
                  {v > 0.009 ? '+' : v < -0.009 ? '\u2212' : ''}{fmtMoney(v, currency)}
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="card">
        <h2 className="card-title">To settle up</h2>
        {allSettled ? (
          <p className="empty">Nothing pending &mdash; the flat is all square.</p>
        ) : (
          <ul className="transfer-list">
            {transfers.map((t, i) => (
              <li key={i} className="transfer-row">
                <span className="transfer-text">
                  <strong>{t.from === me.id ? 'You' : nameOf(t.from)}</strong>
                  {' pays '}
                  <strong>{t.to === me.id ? 'you' : nameOf(t.to)}</strong>
                </span>
                <span className="money">{fmtMoney(t.amount, currency)}</span>
              </li>
            ))}
          </ul>
        )}
        {!allSettled && (
          <button className="btn ghost block" onClick={onGoSettle}>
            Record a payment
          </button>
        )}
      </section>
    </div>
  )
}

function formatExpenseDate(value) {
  if (!value) return ''
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
