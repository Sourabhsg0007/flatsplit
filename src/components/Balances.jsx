import { computeNetBalances, computeTotalSpent, computeTotalGroupExpenses, simplifyDebts, fmtMoney } from '../lib/balances'

export default function Balances({ me, members, expenses, settlements, currency, onGoSettle }) {
  const memberIds = members.map((m) => m.id)
  const net = computeNetBalances(memberIds, expenses, settlements)
  const totals = computeTotalSpent(memberIds, expenses)
  const totalExpenses = computeTotalGroupExpenses(expenses)
  const transfers = simplifyDebts(net)
  const myNet = net[me.id] ?? 0
  const nameOf = (id) => members.find((m) => m.id === id)?.full_name || 'Someone'
  const allSettled = transfers.length === 0

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
            return (
              <li key={m.id} className="ledger-row">
                <span className="ledger-name">
                  {m.full_name}
                  {m.id === me.id && <em className="you-tag">you</em>}
                </span>
                <span className="money">{fmtMoney(spent, currency)} <span className="pct">({share}%)</span></span>
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