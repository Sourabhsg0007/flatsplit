import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { fmtMoney } from '../lib/balances'

const CATEGORIES = [
  'Food & Groceries', 'Rent', 'Utilities', 'Transportation',
  'Entertainment', 'Shopping', 'Health', 'Other',
]

export default function Activity({ me, members, expenses, settlements, currency, onChanged, onEditExpense }) {
  const [expanded, setExpanded] = useState(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [sortOrder, setSortOrder] = useState('newest')
  const nameOf = (id) => members.find((m) => m.id === id)?.full_name || 'Someone'

  let filtered = [
    ...expenses.map((e) => ({ kind: 'expense', date: e.expense_date, created: e.created_at, data: e })),
    ...settlements.map((s) => ({ kind: 'settlement', date: s.created_at.slice(0, 10), created: s.created_at, data: s })),
  ]

  if (search.trim()) {
    const q = search.toLowerCase()
    filtered = filtered.filter((item) => {
      if (item.kind === 'expense') {
        return item.data.description.toLowerCase().includes(q) ||
          (item.data.category || '').toLowerCase().includes(q)
      }
      return nameOf(item.data.from_user).toLowerCase().includes(q) ||
        nameOf(item.data.to_user).toLowerCase().includes(q)
    })
  }

  if (categoryFilter) {
    filtered = filtered.filter(
      (item) => item.kind === 'expense' && item.data.category === categoryFilter
    )
  }

  filtered.sort((a, b) => {
    const cmp = a.date === b.date ? (a.created < b.created ? 1 : -1) : a.date < b.date ? 1 : -1
    return sortOrder === 'oldest' ? -cmp : cmp
  })

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

  if (filtered.length === 0) {
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

        <div className="field-row activity-controls">
          <input
            type="text"
            className="activity-search"
            placeholder="Search expenses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="activity-sort">
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </select>
        </div>

        <div className="activity-categories">
          <button
            className={`cat-chip ${!categoryFilter ? 'active' : ''}`}
            onClick={() => setCategoryFilter('')}
          >
            All
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              className={`cat-chip ${categoryFilter === c ? 'active' : ''}`}
              onClick={() => setCategoryFilter(categoryFilter === c ? '' : c)}
            >
              {c}
            </button>
          ))}
        </div>

        <ul className="activity-list">
          {filtered.map((item) => {
            if (item.kind === 'settlement') {
              const s = item.data
              return (
                <li key={`s-${s.id}`} className="activity-row settlement">
                  <div className="activity-main">
                    <span className="activity-desc">
                      {s.from_user === me.id ? 'You' : nameOf(s.from_user)} paid{' '}
                      {s.to_user === me.id ? 'you' : nameOf(s.to_user)}
                      {s.note ? ` \u00B7 ${s.note}` : ''}
                    </span>
                    <span className="activity-meta">{prettyDate(item.date)} · settlement</span>
                  </div>
                  <span className="money">{fmtMoney(s.amount, currency)}</span>
                  <button className="icon-btn" title="Delete payment" onClick={() => deleteSettlement(s.id)}>{'\u2715'}</button>
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
                  <span className="activity-desc">
                    {e.description}
                    {e.category && <span className="activity-cat-tag">{e.category}</span>}
                  </span>
                  <span className="activity-meta">
                    {prettyDate(item.date)} · {e.paid_by === me.id ? 'you' : nameOf(e.paid_by)} paid
                    {mine ? ` \u00B7 your share ${fmtMoney(mine.amount, currency)}` : ' \u00B7 not your split'}
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
                <div className="activity-actions">
                  <button className="icon-btn" title="Edit expense" onClick={() => onEditExpense(e)}>{'\u270E'}</button>
                  <button className="icon-btn" title="Delete expense" onClick={() => deleteExpense(e.id)}>{'\u2715'}</button>
                </div>
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