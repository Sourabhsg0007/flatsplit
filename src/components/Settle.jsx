import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { computeNetBalances, simplifyDebts, fmtMoney } from '../lib/balances'
import { useToast } from './Toast'

export default function Settle({ group, me, members, expenses, settlements, onSaved }) {
  const memberIds = members.map((m) => m.id)
  const net = computeNetBalances(memberIds, expenses, settlements)
  const suggestions = simplifyDebts(net)
  const nameOf = (id) => members.find((m) => m.id === id)?.full_name || 'Someone'
  const toast = useToast()

  const others = members.filter((m) => m.id !== me.id)
  const [fromUser, setFromUser] = useState(me.id)
  const [toUser, setToUser] = useState(others[0]?.id || '')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  function applySuggestion(t) {
    setFromUser(t.from)
    setToUser(t.to)
    setAmount(String(t.amount))
    setError(null)
  }

  async function save() {
    setError(null)
    const amt = Number(amount)
    if (!fromUser || !toUser) { setError('Pick who paid and who received.'); return }
    if (fromUser === toUser) { setError('Payer and receiver need to be different people.'); return }
    if (!amt || amt <= 0) { setError('Enter an amount greater than zero.'); return }

    setBusy(true)
    const { error: err } = await supabase.from('settlements').insert({
      group_id: group.id,
      from_user: fromUser,
      to_user: toUser,
      amount: amt,
      note: note.trim() || null,
      created_by: me.id,
    })
    setBusy(false)
    if (err) { setError(err.message); return }
    setAmount('')
    setNote('')
    toast('success', 'Payment recorded.')
    onSaved()
  }

  return (
    <div className="page">
      {suggestions.length > 0 && (
        <section className="card">
          <h2 className="card-title">Suggested payments</h2>
          <ul className="transfer-list">
            {suggestions.map((t, i) => (
              <li key={i} className="transfer-row">
                <span className="transfer-text">
                  <strong>{t.from === me.id ? 'You' : nameOf(t.from)}</strong>
                  {' → '}
                  <strong>{t.to === me.id ? 'you' : nameOf(t.to)}</strong>
                </span>
                <span className="money">{fmtMoney(t.amount, group.currency)}</span>
                <button className="btn small" onClick={() => applySuggestion(t)}>Use</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h2 className="card-title">Record a payment</h2>
        <p className="hint">
          Use this after money actually changes hands (UPI, cash, whatever) — it zeroes out that
          much of the balance.
        </p>

        <div className="field-row">
          <label className="field">
            <span>From</span>
            <select value={fromUser} onChange={(e) => setFromUser(e.target.value)}>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id === me.id ? `${m.full_name} (you)` : m.full_name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>To</span>
            <select value={toUser} onChange={(e) => setToUser(e.target.value)}>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id === me.id ? `${m.full_name} (you)` : m.full_name}
                </option>
              ))}
            </select>
          </label>
        </div>

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
            <span>Note (optional)</span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. GPay"
            />
          </label>
        </div>

        {error && <div className="notice error">{error}</div>}

        <button className="btn primary block" onClick={save} disabled={busy}>
          {busy ? 'Recording…' : 'Record payment'}
        </button>
      </section>
    </div>
  )
}
