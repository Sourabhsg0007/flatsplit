import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { fmtMoney } from '../lib/balances'

export default function Activity({ me, members, expenses, settlements, currency, onChanged }) {
  const [expanded, setExpanded] = useState(null)
  const nameOf = (id) => members.find((m) => m.id === id)?.full_name || 'Someone'

  const items = [
    ...expenses.map((e) => ({ kind: 'expense', date: e.expense_date, created: e.created_at, data: e })),
    ...settlements.map((s) => ({ kind: 'settlement', date: s.created_at.slice(0, 10), created: s.created_at, data: s })),
  ].sort((a, b) => (a.date === b.date ? (a.created < b.created ? 1 : -1) : a.date < b.date ? 1 : -1))

  async function deleteExpense(id) {
    if (!window.confirm('Delete this expense for everyone in the group?')) return
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) window.alert(error.message)
    else onChanged()
  }

  async function deleteSettlement(id) {
    if (!window.confirm('Delete this recorded payment for everyone?')) return
    const { error } = await supabase.from('settlements').delete().eq('id', id)
    if (error) window.alert(error.message)
    else onChanged()
  }

  if (items.length === 0) {
    return (
      <div className="page">
        <section className="card">
          <p className="empty">No activity yet. Add your first expense with the + button.</p>
        </section>
      </div>
    )
  }

  return (
    <div className="page">
      <section className="card">
        <h2 className="card-title">Activity</h2>
        <ul className="activity-list">
          {items.map((item) => {
            if (item.kind === 'settlement') {
              const s = item.data
              return (
                <li key={`s-${s.id}`} className="activity-row settlement">
                  <div className="activity-main">
                    <span className="activity-desc">
                      {s.from_user === me.id ? 'You' : nameOf(s.from_user)} paid{' '}
                      {s.to_user === me.id ? 'you' : nameOf(s.to_user)}
                      {s.note ? ` · ${s.note}` : ''}
                    </span>
                    <span className="activity-meta">{prettyDate(item.date)} · settlement</span>
                  </div>
                  <span className="money">{fmtMoney(s.amount, currency)}</span>
                  <button className="icon-btn" title="Delete payment" onClick={() => deleteSettlement(s.id)}>✕</button>
                </li>
              )
            }

            const e = item.data
            const mine = e.splits?.find((sp) => sp.user_id === me.id)
            const isOpen = expanded === e.id
            return (
              <li key={`e-${e.id}`} className="activity-row">
                <div
                  className="activity-main clickable"
                  onClick={() => setExpanded(isOpen ? null : e.id)}
                >
                  <span className="activity-desc">{e.description}</span>
                  <span className="activity-meta">
                    {prettyDate(item.date)} · {e.paid_by === me.id ? 'you' : nameOf(e.paid_by)} paid
                    {mine ? ` · your share ${fmtMoney(mine.amount, currency)}` : ' · not your split'}
                  </span>
                  {isOpen && (
                    <ul className="split-detail">
                      {(e.splits || []).map((sp) => (
                        <li key={sp.user_id}>
                          <span>{sp.user_id === me.id ? 'You' : nameOf(sp.user_id)}</span>
                          <span className="money">{fmtMoney(sp.amount, currency)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <span className="money">{fmtMoney(e.amount, currency)}</span>
                <button className="icon-btn" title="Delete expense" onClick={() => deleteExpense(e.id)}>✕</button>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}

function prettyDate(iso) {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}
