import { computeNetBalances, simplifyDebts, fmtMoney } from '../lib/balances'
import { Badge } from './ui/badge'
import Avatar from './Avatar'
import { Button } from './ui/button'

export default function Balances({ me, members, expenses, settlements, currency, onGoSettle, onAddExpense }) {
  const activeMembers = members.filter((m) => !m.left_at)
  const memberIds = members.map((m) => m.id)
  const net = computeNetBalances(memberIds, expenses, settlements)
  const transfers = simplifyDebts(net)
  const myNet = net[me.id] ?? 0
  const nameOf = (id) => members.find((m) => m.id === id)?.full_name || 'Someone'
  const activeIds = new Set(activeMembers.map((m) => m.id))
  const activeTransfers = transfers.filter((t) => activeIds.has(t.from) && activeIds.has(t.to))
  const allSettled = activeTransfers.length === 0

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
            <Button className="block" onClick={onAddExpense}>
              Add your first expense
            </Button>
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
        <h2 className="card-title">Net balances</h2>
        <ul className="ledger">
          {activeMembers.map((m) => {
            const v = net[m.id] ?? 0
            return (
              <li key={m.id} className="ledger-row person-row">
                <Avatar name={m.full_name} size={34} />
                <span className="ledger-name">
                  {m.full_name}
                  {m.id === me.id && <Badge variant="secondary">you</Badge>}
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
            {activeTransfers.map((t, i) => (
              <li key={i} className="transfer-row">
                <span className="transfer-people">
                  <Avatar name={nameOf(t.from)} size={30} />
                  <span className="transfer-arrow" aria-hidden="true">→</span>
                  <Avatar name={nameOf(t.to)} size={30} />
                </span>
                <span className="transfer-text">
                  <strong>{t.from === me.id ? 'You' : nameOf(t.from)}</strong>
                  {' pays '}
                  <strong>{t.to === me.id ? 'you' : nameOf(t.to)}</strong>
                </span>
                <span className={`money ${t.to === me.id ? 'pos' : t.from === me.id ? 'neg' : ''}`}>{fmtMoney(t.amount, currency)}</span>
              </li>
            ))}
          </ul>
        )}
        <Button variant="outline" className="block" onClick={onGoSettle}>
          {allSettled ? 'Settlement history' : 'Record a payment'}
        </Button>
      </section>
    </div>
  )
}

