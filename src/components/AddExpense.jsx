import { useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { computeSplits, fmtMoney } from '../lib/balances'

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

export default function AddExpense({ group, me, members, onSaved, onCancel, expenseToEdit }) {
  const isEdit = !!expenseToEdit
  const defaultRows = () =>
    members.map((m) => {
      const existing = isEdit
        ? expenseToEdit.splits?.find((s) => s.user_id === m.id)
        : null
      return {
        user_id: m.id,
        included: isEdit ? !!existing : true,
        value: existing ? String(existing.amount) : '',
      }
    })

  const [description, setDescription] = useState(isEdit ? expenseToEdit.description : '')
  const [amount, setAmount] = useState(isEdit ? String(expenseToEdit.amount) : '')
  const [paidBy, setPaidBy] = useState(isEdit ? expenseToEdit.paid_by : me.id)
  const [date, setDate] = useState(
    isEdit ? expenseToEdit.expense_date : new Date().toISOString().slice(0, 10)
  )
  const [splitType, setSplitType] = useState(isEdit ? expenseToEdit.split_type : 'equal')
  const [category, setCategory] = useState(isEdit ? (expenseToEdit.category || '') : '')
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
    onSaved()
  }

  const unitLabel =
    splitType === 'exact' ? group.currency : splitType === 'percent' ? '%' : 'shares'

  return (
    <div className="page">
      <section className="card">
        <h2 className="card-title">{isEdit ? 'Edit expense' : 'Add an expense'}</h2>

        <label className="field">
          <span>Description</span>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Groceries, Wi-Fi bill, Swiggy order"
          />
        </label>

        <div className="field-row">
          <label className="field">
            <span>Amount ({group.currency})</span>
            <input
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
            <span>Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>

        <label className="field">
          <span>Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">None</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Paid by</span>
          <select value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id === me.id ? `${m.full_name} (you)` : m.full_name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="card">
        <h2 className="card-title">Split</h2>
        <div className="seg">
          {SPLIT_TYPES.map((t) => (
            <button
              key={t.key}
              className={splitType === t.key ? 'seg-btn active' : 'seg-btn'}
              onClick={() => setSplitType(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <ul className="split-list">
          {rows.map((r) => {
            const previewAmt = preview?.splits?.find((s) => s.user_id === r.user_id)?.amount
            return (
              <li key={r.user_id} className={`split-row ${r.included ? '' : 'excluded'}`}>
                <label className="split-check">
                  <input
                    type="checkbox"
                    checked={r.included}
                    onChange={(e) => setRow(r.user_id, { included: e.target.checked })}
                  />
                  <span>{r.user_id === me.id ? `${nameOf(r.user_id)} (you)` : nameOf(r.user_id)}</span>
                </label>

                {splitType !== 'equal' && r.included && (
                  <span className="split-input">
                    <input
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

        {preview?.error && total > 0 && <div className="notice error">{preview.error}</div>}
        {error && <div className="notice error">{error}</div>}

        <div className="field-row">
          <button className="btn ghost block" onClick={onCancel}>Cancel</button>
          <button className="btn primary block" onClick={save} disabled={busy}>
            {busy ? 'Saving...' : isEdit ? 'Update expense' : 'Save expense'}
          </button>
        </div>
      </section>
    </div>
  )
}