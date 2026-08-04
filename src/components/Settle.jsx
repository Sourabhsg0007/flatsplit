import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { computeNetBalances, simplifyDebts, fmtMoney } from '../lib/balances'
import { useToast } from './Toast'
import { Alert, AlertDescription } from './ui/alert'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'

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
                <Button size="sm" variant="outline" onClick={() => applySuggestion(t)}>Use</Button>
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
            <Label htmlFor="settle-from">From</Label>
            <Select value={fromUser} onValueChange={setFromUser}>
              <SelectTrigger id="settle-from"><SelectValue /></SelectTrigger>
              <SelectContent>{members.map((m) => <SelectItem key={m.id} value={m.id}>{m.id === me.id ? `${m.full_name} (you)` : m.full_name}</SelectItem>)}</SelectContent>
            </Select>
          </label>
          <label className="field">
            <Label htmlFor="settle-to">To</Label>
            <Select value={toUser} onValueChange={setToUser}>
              <SelectTrigger id="settle-to"><SelectValue /></SelectTrigger>
              <SelectContent>{members.map((m) => <SelectItem key={m.id} value={m.id}>{m.id === me.id ? `${m.full_name} (you)` : m.full_name}</SelectItem>)}</SelectContent>
            </Select>
          </label>
        </div>

        <div className="field-row">
          <label className="field">
            <Label htmlFor="settle-amount">Amount ({group.currency})</Label>
            <Input
              id="settle-amount"
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
            <Label htmlFor="settle-note">Note (optional)</Label>
            <Input
              id="settle-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. GPay"
            />
          </label>
        </div>

        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

        <Button className="block" onClick={save} disabled={busy}>
          {busy ? 'Recording…' : 'Record payment'}
        </Button>
      </section>
    </div>
  )
}
