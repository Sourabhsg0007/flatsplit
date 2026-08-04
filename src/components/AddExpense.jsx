import { useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { computeSplits, fmtMoney } from '../lib/balances'
import { useToast } from './Toast'
import { Alert, AlertDescription } from './ui/alert'
import { Button } from './ui/button'
import { CheckboxControl } from './ui/checkbox'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Tabs, TabsList, TabsTrigger } from './ui/tabs'

const SPLIT_TYPES = [
  { key: 'equal', label: 'Equally' },
  { key: 'exact', label: 'Amounts' },
  { key: 'percent', label: 'Percent' },
  { key: 'shares', label: 'Shares' },
]

const CATEGORIES = [
  'Food & Groceries', 'Rent', 'Utilities', 'Transportation',
  'Entertainment', 'Shopping', 'Health', 'Other',
]

export default function AddExpense({ group, me, members, onSaved, onCancel, expenseToEdit, repeatOf }) {
  const isEdit = !!expenseToEdit
  const isRepeat = !!repeatOf
  const source = isEdit ? expenseToEdit : repeatOf
  const toast = useToast()

  const defaultRows = () =>
    members.map((m) => {
      const existing = source?.splits?.find((s) => s.user_id === m.id)
      return {
        user_id: m.id,
        included: source ? !!existing : true,
        value: existing ? String(existing.amount) : '',
      }
    })

  const [description, setDescription] = useState(source ? source.description : '')
  const [amount, setAmount] = useState(source ? String(source.amount) : '')
  const [paidBy, setPaidBy] = useState(source ? source.paid_by : me.id)
  const [date, setDate] = useState(
    source ? (isRepeat ? new Date().toISOString().slice(0, 10) : source.expense_date) : new Date().toISOString().slice(0, 10)
  )
  const [splitType, setSplitType] = useState(source ? source.split_type : 'equal')
  const [category, setCategory] = useState(
    source ? (source.category || 'Food & Groceries') : 'Food & Groceries'
  )
  const [rows, setRows] = useState(defaultRows)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const total = Number(amount) || 0
  const nameOf = (id) => members.find((m) => m.id === id)?.full_name || 'Someone'

  const preview = useMemo(() => {
    if (total <= 0) return null
    try {
      const splits = computeSplits(
        splitType,
        total,
        rows.map((r) => ({ ...r, value: r.value }))
      )
      return { splits, error: null }
    } catch (e) {
      return { splits: null, error: e.message }
    }
  }, [splitType, total, rows])

  function setRow(userId, patch) {
    setRows((prev) => prev.map((r) => (r.user_id === userId ? { ...r, ...patch } : r)))
  }

  async function save() {
    setError(null)
    if (!description.trim()) { setError('What was this expense for?'); return }
    if (!category) { setError('Select a category.'); return }
    if (total <= 0) { setError('Enter an amount greater than zero.'); return }
    if (!preview || preview.error) { setError(preview?.error || 'Check the split values.'); return }

    setBusy(true)
    const payload = {
      gid: group.id,
      descr: description.trim(),
      total,
      payer: paidBy,
      edate: date,
      stype: splitType,
      splits: preview.splits,
    }

    let err = null
    if (isEdit) {
      const { error: e } = await supabase.rpc('update_expense', {
        eid: expenseToEdit.id,
        descr: description.trim(),
        total,
        payer: paidBy,
        edate: date,
        stype: splitType,
        cat: category,
        splits: preview.splits,
      })
      err = e
    } else {
      const { error: e } = await supabase.rpc('add_expense', {
        ...payload,
        cat: category || null,
      })
      err = e
    }
    setBusy(false)
    if (err) { setError(err.message); return }
    toast('success', isEdit ? 'Expense updated.' : 'Expense added.')
    onSaved()
  }

  const unitLabel =
    splitType === 'exact' ? group.currency : splitType === 'percent' ? '%' : 'shares'

  return (
    <div className="page">
      <section className="card">
        <h2 className="card-title">
          {isEdit ? 'Edit expense' : isRepeat ? 'Repeat expense' : 'Add an expense'}
        </h2>

        <label className="field">
          <Label htmlFor="expense-description">Description</Label>
          <Input
            id="expense-description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Groceries, Wi-Fi bill, Swiggy order"
          />
        </label>

        <div className="field-row">
          <label className="field">
            <Label htmlFor="expense-amount">Amount ({group.currency})</Label>
            <Input
              id="expense-amount"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </label>
          <label className="field">
            <Label htmlFor="expense-date">Date</Label>
            <Input id="expense-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>

        <label className="field">
          <Label htmlFor="expense-category">Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger id="expense-category"><SelectValue /></SelectTrigger>
            <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </label>

        <label className="field">
          <Label htmlFor="expense-paid-by">Paid by</Label>
          <Select value={paidBy} onValueChange={setPaidBy}>
            <SelectTrigger id="expense-paid-by"><SelectValue /></SelectTrigger>
            <SelectContent>{members.map((m) => <SelectItem key={m.id} value={m.id}>{m.id === me.id ? `${m.full_name} (you)` : m.full_name}</SelectItem>)}</SelectContent>
          </Select>
        </label>
      </section>

      <section className="card">
        <h2 className="card-title">Split</h2>
        <Tabs value={splitType} onValueChange={setSplitType}>
          <TabsList>
            {SPLIT_TYPES.map((t) => <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>)}
          </TabsList>
        </Tabs>

        <ul className="split-list">
          {rows.map((r) => {
            const previewAmt = preview?.splits?.find((s) => s.user_id === r.user_id)?.amount
            return (
              <li key={r.user_id} className={`split-row ${r.included ? '' : 'excluded'}`}>
                <label className="split-check">
                  <CheckboxControl
                    checked={r.included}
                    onCheckedChange={(checked) => setRow(r.user_id, { included: checked === true })}
                  />
                  <span>{r.user_id === me.id ? `${nameOf(r.user_id)} (you)` : nameOf(r.user_id)}</span>
                </label>

                {splitType !== 'equal' && r.included && (
                  <span className="split-input">
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step={splitType === 'exact' ? '0.01' : '1'}
                      value={r.value}
                      onChange={(e) => setRow(r.user_id, { value: e.target.value })}
                      placeholder="0"
                    />
                    <em>{unitLabel}</em>
                  </span>
                )}

                {r.included && previewAmt !== undefined && (
                  <span className="money preview">{fmtMoney(previewAmt, group.currency)}</span>
                )}
              </li>
            )
          })}
        </ul>

        {preview?.error && total > 0 && <Alert variant="destructive"><AlertDescription>{preview.error}</AlertDescription></Alert>}
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

        <div className="field-row">
          <Button className="block" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button className="block" onClick={save} disabled={busy}>
            {busy ? 'Saving...' : isEdit ? 'Update expense' : isRepeat ? 'Save as new' : 'Save expense'}
          </Button>
        </div>
      </section>
    </div>
  )
}
