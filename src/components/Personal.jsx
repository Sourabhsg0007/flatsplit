import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileUp, Lock, Pencil, Plus, Sparkles, Trash2, X } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { fmtMoney, fmtMoneyShort } from '../lib/balances'
import DonutChart from './DonutChart'
import ImportStatement from './ImportStatement'
import CategoryChip from './CategoryChip'
import { analyzePersonality } from '../lib/personality'
import { useToast } from './Toast'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'

const CATEGORIES = [
  'Food & Groceries', 'Rent', 'Utilities', 'Transportation',
  'Entertainment', 'Shopping', 'Health', 'Subscriptions', 'Other',
]

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const emptyForm = () => ({
  description: '',
  amount: '',
  category: 'Food & Groceries',
  expense_date: new Date().toISOString().slice(0, 10),
})

// Private tracker — rows live in personal_expenses which only the
// signed-in user can read or write (enforced by RLS).
export default function Personal({ me, groups, currency }) {
  const [items, setItems] = useState(null) // null = loading
  const [groupSpend, setGroupSpend] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showPersona, setShowPersona] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [busy, setBusy] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState(null)
  const toast = useToast()
  const persona = useMemo(() => analyzePersonality(items || []), [items])

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('personal_expenses')
      .select('*')
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) { toast('error', error.message); return }
    setItems(data || [])
  }, [toast])

  useEffect(() => { load() }, [load])

  // My share of expenses across every group I'm in, so the Personal tab can
  // show a true monthly total (personal spend + group spend).
  const loadGroupSpend = useCallback(async () => {
    if (!groups || groups.length === 0) { setGroupSpend([]); return }
    const { data, error } = await supabase
      .from('expenses')
      .select('expense_date, splits:expense_splits(user_id, amount)')
      .in('group_id', groups.map((g) => g.id))
    if (error) { toast('error', error.message); return }
    setGroupSpend(data || [])
  }, [groups, toast])

  useEffect(() => { loadGroupSpend() }, [loadGroupSpend])

  const visible = useMemo(
    () => (items || []).filter((i) => !selectedCategory || i.category === selectedCategory),
    [items, selectedCategory]
  )

  // Group into months: [["2026-08", { label, items, total }], ...]
  const months = useMemo(() => {
    const map = new Map()
    for (const item of visible) {
      const key = item.expense_date.slice(0, 7)
      if (!map.has(key)) {
        const [y, m] = key.split('-')
        map.set(key, { label: `${MONTH_NAMES[Number(m) - 1]} ${y}`, items: [], total: 0 })
      }
      const bucket = map.get(key)
      bucket.items.push(item)
      bucket.total += Number(item.amount)
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [visible])

  const thisMonthKey = new Date().toISOString().slice(0, 7)
  const thisMonthTotal = (items || [])
    .filter((i) => i.expense_date.startsWith(thisMonthKey))
    .reduce((sum, i) => sum + Number(i.amount), 0)
  const thisMonthGroup = (groupSpend || [])
    .filter((e) => (e.expense_date || '').startsWith(thisMonthKey))
    .reduce((sum, e) => sum + Number((e.splits || []).find((s) => s.user_id === me.id)?.amount || 0), 0)

  // Personal + group shares combined, one row per month.
  const monthly = useMemo(() => {
    const map = new Map()
    for (const item of items || []) {
      const key = item.expense_date.slice(0, 7)
      if (!map.has(key)) {
        const [y, m] = key.split('-')
        map.set(key, { key, label: `${MONTH_NAMES[Number(m) - 1]} ${y}`, personal: 0, group: 0 })
      }
      map.get(key).personal += Number(item.amount)
    }
    for (const e of groupSpend || []) {
      const mySplit = (e.splits || []).find((s) => s.user_id === me.id)
      if (!mySplit || !e.expense_date) continue
      const key = e.expense_date.slice(0, 7)
      if (!map.has(key)) {
        const [y, m] = key.split('-')
        map.set(key, { key, label: `${MONTH_NAMES[Number(m) - 1]} ${y}`, personal: 0, group: 0 })
      }
      map.get(key).group += Number(mySplit.amount)
    }
    return [...map.values()].sort((a, b) => b.key.localeCompare(a.key))
  }, [items, groupSpend, me.id])

  const categoryData = useMemo(() => {
    const totals = {}
    for (const item of items || []) {
      totals[item.category] = (totals[item.category] || 0) + Number(item.amount)
    }
    return Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value }))
  }, [items])

  function startEdit(item) {
    setEditingId(item.id)
    setForm({
      description: item.description,
      amount: String(item.amount),
      category: item.category,
      expense_date: item.expense_date,
    })
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm())
  }

  async function save() {
    const amount = Number(form.amount)
    if (!form.description.trim()) { toast('error', 'What did you spend on?'); return }
    if (!amount || amount <= 0) { toast('error', 'Enter an amount greater than zero.'); return }

    setBusy(true)
    const payload = {
      description: form.description.trim(),
      amount,
      category: form.category,
      expense_date: form.expense_date,
    }
    const { error } = editingId
      ? await supabase.from('personal_expenses').update(payload).eq('id', editingId)
      : await supabase.from('personal_expenses').insert({ ...payload, user_id: me.id })
    setBusy(false)
    if (error) { toast('error', error.message); return }
    toast('success', editingId ? 'Expense updated.' : 'Expense added.')
    closeForm()
    load()
  }

  async function remove(item) {
    const { error } = await supabase.from('personal_expenses').delete().eq('id', item.id)
    if (error) { toast('error', error.message); return }
    load()
    toast('success', 'Expense deleted.', {
      label: 'Undo',
      onClick: async () => {
        const { error: undoErr } = await supabase.from('personal_expenses').insert({
          user_id: me.id,
          description: item.description,
          amount: item.amount,
          category: item.category,
          expense_date: item.expense_date,
        })
        if (undoErr) toast('error', undoErr.message)
        else load()
      },
    })
  }

  return (
    <div className="page">
      <section className="hero-balance personal-hero">
        <span className="hero-label"><Lock size={12} /> Only you can see this</span>
        <span className="hero-amount">{fmtMoney(thisMonthTotal + thisMonthGroup, currency)}</span>
        <span className="hero-sub">your spending this month · Personal + groups</span>
      </section>

      {showForm && (
        <section className="card form-pop">
          <div className="card-title-row">
            <h2 className="card-title">{editingId ? 'Edit expense' : 'Add a personal expense'}</h2>
            <Button size="icon" variant="ghost" onClick={closeForm} aria-label="Close form"><X size={16} /></Button>
          </div>
          <label className="field">
            <Label htmlFor="personal-desc">Description</Label>
            <Input
              id="personal-desc"
              type="text"
              value={form.description}
              placeholder="e.g. Chai, auto to office, movie ticket"
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </label>
          <div className="field-row">
            <label className="field">
              <Label htmlFor="personal-amount">Amount ({currency})</Label>
              <Input
                id="personal-amount"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={form.amount}
                placeholder="0.00"
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </label>
            <label className="field">
              <Label htmlFor="personal-date">Date</Label>
              <Input
                id="personal-date"
                type="date"
                value={form.expense_date}
                onChange={(e) => setForm((f) => ({ ...f, expense_date: e.target.value }))}
              />
            </label>
          </div>
          <label className="field">
            <Label htmlFor="personal-category">Category</Label>
            <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
              <SelectTrigger id="personal-category"><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </label>
          <Button className="block" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : editingId ? 'Update expense' : 'Save expense'}
          </Button>
        </section>
      )}

      {!showForm && !showImport && (
        <div className="field-row personal-actions">
          <Button className="block" onClick={() => setShowForm(true)}>
            <Plus size={16} /> Add expense
          </Button>
          <Button className="block" variant="outline" onClick={() => setShowImport(true)}>
            <FileUp size={15} /> Import statement
          </Button>
        </div>
      )}

      {showImport && (
        <ImportStatement
          me={me}
          currency={currency}
          onImported={load}
          onClose={() => setShowImport(false)}
        />
      )}

      {(items?.length ?? 0) > 0 && (
        <section className="card persona-card">
          <button
            type="button"
            className="month-header clickable-header"
            onClick={() => setShowPersona((v) => !v)}
            aria-expanded={showPersona}
          >
            <span className="month-title-wrap">
              <Sparkles size={15} className="persona-spark" />
              <span className="month-title">Your money personality</span>
            </span>
            <span className="persona-peek">{persona.enough ? `${persona.archetype.emoji} ${persona.archetype.name}` : '🌱'}</span>
          </button>
          {showPersona && (
            <div className="persona-body">
              <div className="persona-hero">
                <span className="persona-emoji">{persona.archetype.emoji}</span>
                <div>
                  <h3 className="persona-name">{persona.archetype.name}</h3>
                  <p className="persona-blurb">{persona.archetype.blurb}</p>
                </div>
              </div>
              {persona.enough && (
                <ul className="persona-traits">
                  {persona.traits.map((t) => (
                    <li key={t.label} className="persona-trait">
                      <span className="persona-trait-label">{t.label}</span>
                      <span className="persona-trait-value">
                        {t.amount != null ? <span className="money">{fmtMoney(t.amount, currency)}</span> : t.value}
                      </span>
                      <span className="persona-trait-detail">{t.detail}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="hint">Computed on your device from your personal expenses — imports included, nothing shared with the group.</p>
            </div>
          )}
        </section>
      )}

      {categoryData.length > 0 && (
        <section className="card">
          <h2 className="card-title">Where your money goes</h2>
          <p className="hint">Tap a slice to filter the list below.</p>
          <DonutChart
            data={categoryData}
            selected={selectedCategory}
            onSelect={setSelectedCategory}
            formatValue={(v) => fmtMoney(v, currency)}
          />
        </section>
      )}

      {monthly.length > 0 && (
        <section className="card">
          <h2 className="card-title">Month-by-month total</h2>
          <p className="hint">Your personal spend + your share of expenses in all {groups.length} group{groups.length === 1 ? '' : 's'}.</p>
          <ul className="month-grid">
            {monthly.map((m) => (
              <li key={m.key} className="month-box">
                <span className="month-box-label">{m.label}</span>
                <span className="month-box-total money">{fmtMoneyShort(m.personal + m.group, currency)}</span>
                <span className="month-box-split">
                  <span className="month-box-part">personal <span className="money">{fmtMoneyShort(m.personal, currency)}</span></span>
                  <span className="month-box-part">groups <span className="money">{fmtMoneyShort(m.group, currency)}</span></span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {items === null ? (
        <section className="card"><p className="empty">Loading…</p></section>
      ) : months.length === 0 ? (
        <section className="card">
          <div className="empty-state">
            <p className="empty">
              {selectedCategory
                ? `Nothing under ${selectedCategory} yet.`
                : 'Nothing tracked yet. Add what you spent today — it stays private to you.'}
            </p>
            {selectedCategory && (
              <Button variant="outline" onClick={() => setSelectedCategory(null)}>Show everything</Button>
            )}
          </div>
        </section>
      ) : (
        months.map(([key, month]) => (
          <section key={key} className="card month-section">
            <div className="month-header">
              <h2 className="card-title">{month.label}</h2>
              <span className="money">{fmtMoney(month.total, currency)}</span>
            </div>
            <ul className="activity-list">
              {month.items.map((item) => (
                <li key={item.id} className="activity-row with-chip">
                  <CategoryChip category={item.category} />
                  <div className="activity-main">
                    <span className="activity-desc">{item.description}</span>
                    <span className="activity-meta">
                      {prettyDate(item.expense_date)} · {item.category}
                    </span>
                  </div>
                  <span className="money">{fmtMoney(item.amount, currency)}</span>
                  <div className="activity-actions">
                    <Button size="icon" variant="ghost" className="icon-btn" title="Edit" onClick={() => startEdit(item)}>
                      <Pencil size={15} />
                    </Button>
                    <Button size="icon" variant="ghost" className="icon-btn danger" title="Delete" onClick={() => remove(item)}>
                      <Trash2 size={15} />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}

function prettyDate(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}
