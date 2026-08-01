import { useState } from 'react'
import { Copy, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { fmtMoney } from '../lib/balances'
import ConfirmDialog from './ConfirmDialog'
import { useToast } from './Toast'

const CATEGORIES = [
  'Food & Groceries', 'Rent', 'Utilities', 'Transportation',
  'Entertainment', 'Shopping', 'Health', 'Other',
]

export default function Activity({ me, members, expenses, settlements, currency, onChanged, onEditExpense, onRepeatExpense }) {
  const [expanded, setExpanded] = useState(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [sortOrder, setSortOrder] = useState('newest')
  const [confirmTarget, setConfirmTarget] = useState(null) // { kind, id }
  const [busy, setBusy] = useState(false)
  const toast = useToast()
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

  async function runDelete() {
    if (!confirmTarget) return
    setBusy(true)
    const { kind, id } = confirmTarget
    const table = kind === 'expense' ? 'expenses' : 'settlements'
    const { error } = await supabase.from(table).delete().eq('id', id)
    setBusy(false)
    setConfirmTarget(null)
    if (error) {
      toast('error', error.message)
      return
    }
    toast('success', kind === 'expense' ? 'Expense deleted.' : 'Payment deleted.')
    onChanged()
  }

  if (filtered.length === 0) {
    return (
      <div className="page">
        <section className="card">
          <div className="empty-state">
            <p className="empty">
              {search || categoryFilter
                ? 'Nothing matches that filter.'
                : 'No activity yet. Add your first expense and it shows up here.'}
            </p>
            <button className="btn primary block" onClick={() => onEditExpense(null)}>
              Add an expense
            </button>
          </div>
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
                  <button className="icon-btn" title="Delete payment" onClick={() => setConfirmTarget({ kind: 'settlement', id: s.id })}>
                    <Trash2 size={16} />
                  </button>
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
                  <button className="icon-btn" title="Repeat this expense" onClick={() => onRepeatExpense(e)}>
                    <Copy size={15} />
                  </button>
                  <button className="icon-btn" title="Edit expense" onClick={() => onEditExpense(e)}>
                    <Pencil size={15} />
                  </button>
                  <button className="icon-btn danger" title="Delete expense" onClick={() => setConfirmTarget({ kind: 'expense', id: e.id })}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      {confirmTarget && (
        <ConfirmDialog
          title={confirmTarget.kind === 'expense' ? 'Delete this expense?' : 'Delete this payment?'}
          body={
            confirmTarget.kind === 'expense'
              ? 'This removes it for everyone in the group.'
              : 'This removes the recorded payment for everyone in the group.'
          }
          confirmLabel={busy ? 'Deleting…' : 'Delete'}
          onConfirm={runDelete}
          onCancel={() => setConfirmTarget(null)}
        />
      )}
    </div>
  )
}

function prettyDate(iso) {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}
