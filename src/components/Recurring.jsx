import { useCallback, useEffect, useState } from 'react'
import { CalendarClock, Pause, Play, Plus, Trash2, X } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { computeSplits, fmtMoney } from '../lib/balances'
import ConfirmDialog from './ConfirmDialog'
import { useToast } from './Toast'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { CheckboxControl } from './ui/checkbox'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'

const CATEGORIES = [
  'Rent', 'Utilities', 'Food & Groceries', 'Transportation',
  'Entertainment', 'Shopping', 'Health', 'Other',
]

// Monthly recurring bills — rent, Wi-Fi, maid, etc. Split equally
// among the chosen members; auto-added on the due day each month.
export default function Recurring({ group, me, members, onGenerated }) {
  const [rules, setRules] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [paidBy, setPaidBy] = useState(me.id)
  const [category, setCategory] = useState('Rent')
  const [dayOfMonth, setDayOfMonth] = useState('1')
  const [included, setIncluded] = useState(() => new Set(members.map((m) => m.id)))
  const [busy, setBusy] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const toast = useToast()
  const nameOf = (id) => members.find((m) => m.id === id)?.full_name || 'Someone'

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('recurring_expenses')
      .select('*')
      .eq('group_id', group.id)
      .order('created_at', { ascending: true })
    if (error) { toast('error', error.message); return }
    setRules(data || [])
  }, [group.id, toast])

  useEffect(() => { load() }, [load])

  function toggleMember(id) {
    setIncluded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function nextDueFrom(day) {
    const now = new Date()
    const candidate = new Date(now.getFullYear(), now.getMonth(), day)
    if (candidate <= now) candidate.setMonth(candidate.getMonth() + 1)
    // Build YYYY-MM-DD without timezone surprises
    const y = candidate.getFullYear()
    const m = String(candidate.getMonth() + 1).padStart(2, '0')
    const d = String(candidate.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  async function save() {
    const total = Number(amount)
    if (!description.trim()) { toast('error', 'What is this bill for?'); return }
    if (!total || total <= 0) { toast('error', 'Enter an amount greater than zero.'); return }
    const chosen = members.filter((m) => included.has(m.id))
    if (chosen.length === 0) { toast('error', 'Pick at least one person to split with.'); return }

    let splits
    try {
      splits = computeSplits('equal', total, chosen.map((m) => ({ user_id: m.id })))
    } catch (e) {
      toast('error', e.message)
      return
    }

    setBusy(true)
    const { error } = await supabase.from('recurring_expenses').insert({
      group_id: group.id,
      description: description.trim(),
      amount: total,
      paid_by: paidBy,
      category,
      day_of_month: Number(dayOfMonth),
      splits,
      next_due: nextDueFrom(Number(dayOfMonth)),
      created_by: me.id,
    })
    setBusy(false)
    if (error) { toast('error', error.message); return }
    toast('success', 'Recurring expense set up.')
    setShowForm(false)
    setDescription('')
    setAmount('')
    load()
  }

  async function toggleActive(rule) {
    const { error } = await supabase
      .from('recurring_expenses')
      .update({ active: !rule.active })
      .eq('id', rule.id)
    if (error) { toast('error', error.message); return }
    toast('success', rule.active ? 'Paused.' : 'Resumed — next bill lands on the due date.')
    load()
  }

  async function runDelete() {
    if (!confirmDeleteId) return
    const { error } = await supabase.from('recurring_expenses').delete().eq('id', confirmDeleteId)
    setConfirmDeleteId(null)
    if (error) { toast('error', error.message); return }
    toast('success', 'Recurring expense removed. Past bills stay in Activity.')
    load()
  }

  async function generateNow() {
    const { data, error } = await supabase.rpc('generate_due_recurring', { gid: group.id })
    if (error) { toast('error', error.message); return }
    toast('success', data > 0 ? `Added ${data} due bill${data === 1 ? '' : 's'}.` : 'Nothing due right now.')
    if (data > 0 && onGenerated) onGenerated()
    load()
  }

  return (
    <section className="card">
      <div className="card-title-row">
        <div>
          <h2 className="card-title"><CalendarClock size={16} /> Recurring expenses</h2>
          <p className="hint">Rent, Wi-Fi, maid — added automatically every month, split equally.</p>
        </div>
        {!showForm && (
          <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
            <Plus size={14} /> New
          </Button>
        )}
      </div>

      {showForm && (
        <div className="recurring-form form-pop">
          <div className="card-title-row">
            <span className="field-label-strong">New recurring bill</span>
            <Button size="icon" variant="ghost" onClick={() => setShowForm(false)} aria-label="Close"><X size={15} /></Button>
          </div>
          <label className="field">
            <Label htmlFor="rec-desc">Description</Label>
            <Input id="rec-desc" type="text" value={description} placeholder="e.g. Rent, Wi-Fi bill" onChange={(e) => setDescription(e.target.value)} />
          </label>
          <div className="field-row">
            <label className="field">
              <Label htmlFor="rec-amount">Amount ({group.currency})</Label>
              <Input id="rec-amount" type="number" inputMode="decimal" min="0" step="0.01" value={amount} placeholder="0.00" onChange={(e) => setAmount(e.target.value)} />
            </label>
            <label className="field">
              <Label htmlFor="rec-day">Due on day</Label>
              <Select value={dayOfMonth} onValueChange={setDayOfMonth}>
                <SelectTrigger id="rec-day"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 28 }, (_, i) => String(i + 1)).map((d) => (
                    <SelectItem key={d} value={d}>{d}{ordinal(Number(d))} of the month</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>
          <div className="field-row">
            <label className="field">
              <Label htmlFor="rec-paidby">Paid by</Label>
              <Select value={paidBy} onValueChange={setPaidBy}>
                <SelectTrigger id="rec-paidby"><SelectValue /></SelectTrigger>
                <SelectContent>{members.map((m) => <SelectItem key={m.id} value={m.id}>{m.id === me.id ? `${m.full_name} (you)` : m.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </label>
            <label className="field">
              <Label htmlFor="rec-cat">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="rec-cat"><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </label>
          </div>
          <span className="field-label-strong">Split equally between</span>
          <ul className="split-list">
            {members.map((m) => (
              <li key={m.id} className={`split-row ${included.has(m.id) ? '' : 'excluded'}`}>
                <label className="split-check">
                  <CheckboxControl checked={included.has(m.id)} onCheckedChange={() => toggleMember(m.id)} />
                  <span>{m.id === me.id ? `${m.full_name} (you)` : m.full_name}</span>
                </label>
              </li>
            ))}
          </ul>
          <Button className="block" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : 'Set up recurring expense'}
          </Button>
        </div>
      )}

      {rules === null ? (
        <p className="empty">Loading…</p>
      ) : rules.length === 0 && !showForm ? (
        <p className="empty">No recurring bills yet. Set up rent once and forget about it.</p>
      ) : (
        <ul className="activity-list">
          {rules.map((rule) => (
            <li key={rule.id} className={`activity-row ${rule.active ? '' : 'recurring-paused'}`}>
              <div className="activity-main">
                <span className="activity-desc">
                  {rule.description}
                  {!rule.active && <Badge variant="secondary">paused</Badge>}
                </span>
                <span className="activity-meta">
                  {fmtMoney(rule.amount, group.currency)} · {nameOf(rule.paid_by)} pays ·{' '}
                  {rule.active ? `next on ${prettyDate(rule.next_due)}` : 'not running'} ·{' '}
                  {rule.splits.length} people
                </span>
              </div>
              <div className="activity-actions">
                <Button size="icon" variant="ghost" className="icon-btn" title={rule.active ? 'Pause' : 'Resume'} onClick={() => toggleActive(rule)}>
                  {rule.active ? <Pause size={15} /> : <Play size={15} />}
                </Button>
                <Button size="icon" variant="ghost" className="icon-btn danger" title="Delete rule" onClick={() => setConfirmDeleteId(rule.id)}>
                  <Trash2 size={15} />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {rules && rules.some((r) => r.active) && (
        <Button variant="link" className="block" onClick={generateNow}>
          Check for due bills now
        </Button>
      )}

      {confirmDeleteId && (
        <ConfirmDialog
          title="Remove this recurring expense?"
          body="Future bills stop. Ones already added stay in Activity."
          confirmLabel="Remove"
          onConfirm={runDelete}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </section>
  )
}

function ordinal(n) {
  if (n % 10 === 1 && n !== 11) return 'st'
  if (n % 10 === 2 && n !== 12) return 'nd'
  if (n % 10 === 3 && n !== 13) return 'rd'
  return 'th'
}

function prettyDate(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}
