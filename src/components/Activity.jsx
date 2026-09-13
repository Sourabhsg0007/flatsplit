import { useMemo, useState } from 'react'
import { ChevronDown, Copy, MessageCircle, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { fmtMoney } from '../lib/balances'
import ConfirmDialog from './ConfirmDialog'
import ExpenseSocial from './ExpenseSocial'
import { useToast } from './Toast'
import { Badge } from './ui/badge'
import CategoryChip from './CategoryChip'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'

const CATEGORIES = [
  'Food & Groceries', 'Rent', 'Utilities', 'Transportation',
  'Entertainment', 'Shopping', 'Health', 'Other',
]

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export default function Activity({ me, members, expenses, settlements, currency, onChanged, onEditExpense, onRepeatExpense }) {
  const [expanded, setExpanded] = useState(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [sortOrder, setSortOrder] = useState('newest')
  const [collapsedMonths, setCollapsedMonths] = useState(() => new Set())
  const [confirmTarget, setConfirmTarget] = useState(null) // { kind, data }
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const nameOf = (id) => members.find((m) => m.id === id)?.full_name || 'Someone'

  const filtered = useMemo(() => {
    let items = [
      ...expenses.map((e) => ({ kind: 'expense', date: e.expense_date, created: e.created_at, data: e })),
      ...settlements.map((s) => ({ kind: 'settlement', date: s.created_at.slice(0, 10), created: s.created_at, data: s })),
    ]

    if (search.trim()) {
      const q = search.toLowerCase()
      const lookup = (id) => members.find((m) => m.id === id)?.full_name || 'Someone'
      items = items.filter((item) => {
        if (item.kind === 'expense') {
          return item.data.description.toLowerCase().includes(q) ||
            (item.data.category || '').toLowerCase().includes(q)
        }
        return lookup(item.data.from_user).toLowerCase().includes(q) ||
          lookup(item.data.to_user).toLowerCase().includes(q)
      })
    }

    if (categoryFilter) {
      items = items.filter(
        (item) => item.kind === 'expense' && item.data.category === categoryFilter
      )
    }

    return [...items].sort((a, b) => {
      const cmp = a.date === b.date ? (a.created < b.created ? 1 : -1) : a.date < b.date ? 1 : -1
      return sortOrder === 'oldest' ? -cmp : cmp
    })
  }, [expenses, settlements, search, categoryFilter, sortOrder, members])
  const hasFilters = Boolean(search.trim() || categoryFilter)

  // --- Monthly split sections: "August 2026 split" with totals ---
  const monthSections = useMemo(() => {
    const map = new Map()
    for (const item of filtered) {
      const key = item.date.slice(0, 7)
      if (!map.has(key)) {
        const [y, m] = key.split('-')
        map.set(key, {
          key,
          label: `${MONTH_NAMES[Number(m) - 1]} ${y}`,
          items: [],
          total: 0,
          myShare: 0,
          settled: 0,
        })
      }
      const section = map.get(key)
      section.items.push(item)
      if (item.kind === 'expense') {
        section.total += Number(item.data.amount)
        const mine = item.data.splits?.find((sp) => sp.user_id === me.id)
        if (mine) section.myShare += Number(mine.amount)
      } else {
        section.settled += Number(item.data.amount)
      }
    }
    return [...map.values()] // already in sort order because filtered is sorted
  }, [filtered, me.id])

  function toggleMonth(key) {
    setCollapsedMonths((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // --- delete with undo ---
  async function runDelete() {
    if (!confirmTarget) return
    setBusy(true)
    const { kind, data } = confirmTarget
    const table = kind === 'expense' ? 'expenses' : 'settlements'
    const { error } = await supabase.from(table).delete().eq('id', data.id)
    setBusy(false)
    setConfirmTarget(null)
    if (error) {
      toast('error', error.message)
      return
    }
    onChanged()
    toast('success', kind === 'expense' ? 'Expense deleted.' : 'Payment deleted.', {
      label: 'Undo',
      onClick: () => undoDelete(kind, data),
    })
  }

  async function undoDelete(kind, data) {
    let error = null
    if (kind === 'expense') {
      ;({ error } = await supabase.rpc('add_expense', {
        gid: data.group_id,
        descr: data.description,
        total: Number(data.amount),
        payer: data.paid_by,
        edate: data.expense_date,
        stype: data.split_type,
        cat: data.category || null,
        splits: (data.splits || []).map((sp) => ({ user_id: sp.user_id, amount: Number(sp.amount) })),
      }))
    } else {
      ;({ error } = await supabase.from('settlements').insert({
        group_id: data.group_id,
        from_user: data.from_user,
        to_user: data.to_user,
        amount: Number(data.amount),
        note: data.note,
        created_by: me.id,
      }))
    }
    if (error) { toast('error', `Couldn't restore: ${error.message}`); return }
    toast('success', 'Restored.')
    onChanged()
  }

  function renderItem(item) {
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
          <Button size="icon" variant="ghost" className="icon-btn" title="Delete payment" onClick={() => setConfirmTarget({ kind: 'settlement', data: s })}>
            <Trash2 size={16} />
          </Button>
        </li>
      )
    }

    const e = item.data
    const mine = e.splits?.find((sp) => sp.user_id === me.id)
    const isOpen = expanded === e.id
    return (
      <li key={`e-${e.id}`} className={`activity-row with-chip ${isOpen ? 'open' : ''}`}>
        <CategoryChip category={e.category} />
        <div
          className="activity-main clickable"
          onClick={() => setExpanded(isOpen ? null : e.id)}
        >
          <span className="activity-desc">
            {e.description}
            {e.category && <Badge variant="default" className="activity-cat-tag">{e.category}</Badge>}
            <MessageCircle size={13} className="comment-hint-icon" aria-hidden="true" />
          </span>
          <span className="activity-meta">
            {prettyDate(item.date)} · {e.paid_by === me.id ? 'you' : nameOf(e.paid_by)} paid
            {mine ? ` \u00B7 your share ${fmtMoney(mine.amount, currency)}` : ' \u00B7 not your split'}
          </span>
          {isOpen && (
            <>
              <ul className="split-detail">
                {(e.splits || []).map((sp) => (
                  <li key={sp.user_id}>
                    <span>{sp.user_id === me.id ? 'You' : nameOf(sp.user_id)}</span>
                    <span className="money">{fmtMoney(sp.amount, currency)}</span>
                  </li>
                ))}
              </ul>
              <ExpenseSocial expenseId={e.id} me={me} members={members} />
            </>
          )}
        </div>
        <span className="money">{fmtMoney(e.amount, currency)}</span>
        <div className="activity-actions">
          <Button size="icon" variant="ghost" className="icon-btn" title="Repeat this expense" onClick={() => onRepeatExpense(e)}>
            <Copy size={15} />
          </Button>
          <Button size="icon" variant="ghost" className="icon-btn" title="Edit expense" onClick={() => onEditExpense(e)}>
            <Pencil size={15} />
          </Button>
          <Button size="icon" variant="ghost" className="icon-btn danger" title="Delete expense" onClick={() => setConfirmTarget({ kind: 'expense', data: e })}>
            <Trash2 size={15} />
          </Button>
        </div>
      </li>
    )
  }

  return (
    <div className="page">
      <section className="card">
        <h2 className="card-title">Activity</h2>

        <div className="field-row activity-controls">
          <Input
            type="text"
            className="activity-search"
            placeholder="Search expenses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select value={sortOrder} onValueChange={setSortOrder}>
            <SelectTrigger className="activity-sort"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="activity-categories">
          <Button
            type="button"
            size="sm"
            variant={!categoryFilter ? 'default' : 'outline'}
            className="cat-chip"
            onClick={() => setCategoryFilter('')}
          >
            All
          </Button>
          {CATEGORIES.map((c) => (
            <Button
              key={c}
              type="button"
              size="sm"
              variant={categoryFilter === c ? 'default' : 'outline'}
              className="cat-chip"
              onClick={() => setCategoryFilter(categoryFilter === c ? '' : c)}
            >
              {c}
            </Button>
          ))}
        </div>
      </section>

      {monthSections.length === 0 ? (
        <section className="card">
          <div className="empty-state">
            <p className="empty">
              {hasFilters
                ? 'Nothing matches those filters.'
                : 'No activity yet. Add your first expense and it shows up here.'}
            </p>
            <div className="activity-empty-actions">
              {hasFilters && (
                <Button variant="outline" onClick={() => { setSearch(''); setCategoryFilter('') }}>
                  Clear filters
                </Button>
              )}
              <Button onClick={() => onEditExpense(null)}>
                Add an expense
              </Button>
            </div>
          </div>
        </section>
      ) : (
        monthSections.map((section) => {
          const collapsed = collapsedMonths.has(section.key)
          return (
            <section key={section.key} className="card month-section">
              <button
                type="button"
                className="month-header clickable-header"
                onClick={() => toggleMonth(section.key)}
                aria-expanded={!collapsed}
              >
                <span className="month-title-wrap">
                  <ChevronDown size={16} className={`month-chevron ${collapsed ? 'closed' : ''}`} />
                  <span className="month-title">{section.label} split</span>
                </span>
                <span className="month-summary">
                  <span className="money">{fmtMoney(section.total, currency)}</span>
                  <small>your share {fmtMoney(section.myShare, currency)}</small>
                </span>
              </button>
              {!collapsed && (
                <>
                  <ul className="activity-list">
                    {section.items.map(renderItem)}
                  </ul>
                  {section.settled > 0 && (
                    <p className="hint month-settled-note">
                      {fmtMoney(section.settled, currency)} settled between people this month.
                    </p>
                  )}
                </>
              )}
            </section>
          )
        })
      )}

      {confirmTarget && (
        <ConfirmDialog
          title={confirmTarget.kind === 'expense' ? 'Delete this expense?' : 'Delete this payment?'}
          body={
            confirmTarget.kind === 'expense'
              ? 'This removes it for everyone in the group. You can undo right after.'
              : 'This removes the recorded payment for everyone in the group. You can undo right after.'
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
