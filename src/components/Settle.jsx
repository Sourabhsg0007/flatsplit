import { useEffect, useRef, useState } from 'react'
import { Check, IndianRupee, X } from 'lucide-react'
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
  const upiOf = (id) => members.find((m) => m.id === id)?.upi_id || null
  const canPay = (t) => t.from === me.id && group.currency === '₹' && !!upiOf(t.to)
  const upiParams = (t) =>
    new URLSearchParams({
      pa: upiOf(t.to),
      pn: nameOf(t.to),
      am: t.amount.toFixed(2),
      cu: 'INR',
      tn: `FlatSplit — ${group.name}`,
    }).toString()
  // App-specific UPI intent schemes: same params, each opens its app directly
  // (generic upi:// shows the system chooser).
  const isIOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent)
  const payApps = [
    { key: 'gpay', label: 'GPay', scheme: isIOS ? 'gpay://upi/pay' : 'tez://upi/pay' },
    { key: 'phonepe', label: 'PhonePe', scheme: 'phonepe://pay' },
    { key: 'paytm', label: 'Paytm', scheme: 'paytmmp://pay' },
    { key: 'any', label: 'Any UPI app', scheme: 'upi://pay' },
  ]
  const toast = useToast()

  const others = members.filter((m) => m.id !== me.id)
  const [fromUser, setFromUser] = useState(me.id)
  const [toUser, setToUser] = useState(others[0]?.id || '')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [payMenuFor, setPayMenuFor] = useState(null) // suggestion index with the app chooser open
  const [confirmPayment, setConfirmPayment] = useState(null) // { to, amount, app } once back from the UPI app
  const pendingPaymentRef = useRef(null) // set when a pay link is tapped, read on return

  // When the person comes back from the payment app, ask whether it went
  // through — one tap then records the settlement. (Plain UPI intents can't
  // report success back to a web app, so confirmation stays with the human.)
  useEffect(() => {
    function onReturn() {
      if (document.visibilityState === 'visible' && pendingPaymentRef.current) {
        setConfirmPayment(pendingPaymentRef.current)
        pendingPaymentRef.current = null
      }
    }
    document.addEventListener('visibilitychange', onReturn)
    return () => document.removeEventListener('visibilitychange', onReturn)
  }, [])

  async function recordConfirmedPayment() {
    const p2 = confirmPayment
    if (!p2) return
    const appLabel = payApps.find((a) => a.key === p2.app)?.label
    const { error: err } = await supabase.from('settlements').insert({
      group_id: group.id,
      from_user: me.id,
      to_user: p2.to,
      amount: p2.amount,
      note: p2.app === 'any' ? 'UPI' : appLabel || 'UPI',
      created_by: me.id,
    })
    if (err) { toast('error', err.message); return }
    setConfirmPayment(null)
    toast('success', `Recorded ${fmtMoney(p2.amount, group.currency)} to ${nameOf(p2.to)}.`)
    onSaved()
  }

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
      {confirmPayment && (
        <section className="card pay-confirm-card">
          <p className="pay-confirm-text">
            Did the payment of <strong className="money">{fmtMoney(confirmPayment.amount, group.currency)}</strong> to{' '}
            <strong>{nameOf(confirmPayment.to)}</strong> go through?
          </p>
          <div className="pay-confirm-actions">
            <Button onClick={recordConfirmedPayment}>
              <Check size={15} /> Yes, record it
            </Button>
            <Button variant="outline" onClick={() => setConfirmPayment(null)}>
              <X size={15} /> Not yet
            </Button>
          </div>
        </section>
      )}
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
                {canPay(t) && (
                  <Button size="sm" onClick={() => setPayMenuFor(payMenuFor === i ? null : i)}>
                    <IndianRupee size={13} /> Pay
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => applySuggestion(t)}>Use</Button>
                {canPay(t) && payMenuFor === i && (
                  <span className="pay-app-row">
                    {payApps.map((app) => (
                      <a
                        key={app.key}
                        className="ui-button ui-button-sm ui-button-outline upi-pay-btn"
                        href={`${app.scheme}?${upiParams(t)}`}
                        onClick={() => {
                          pendingPaymentRef.current = { to: t.to, amount: t.amount, app: app.key }
                          setPayMenuFor(null)
                        }}
                      >
                        {app.label}
                      </a>
                    ))}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {suggestions.some((t) => canPay(t)) && (
            <p className="hint">
              <strong>Pay</strong> opens GPay, PhonePe, Paytm or any UPI app with everything
              pre-filled. When you come back, FlatSplit asks if it went through and records it
              in one tap.
            </p>
          )}
          {suggestions.some((t) => t.from === me.id && !upiOf(t.to)) && group.currency === '₹' && (
            <p className="hint">Tip: flatmates who add their UPI ID on their profile get a one-tap Pay button here.</p>
          )}
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

      <section className="card">
        <h2 className="card-title">Settlement history</h2>
        <p className="hint">Every payment ever recorded in this group.</p>
        {settlements.length === 0 ? (
          <p className="empty">No payments recorded yet.</p>
        ) : (
          <ul className="activity-list">
            {settlements.map((s) => (
              <li key={s.id} className="activity-row settlement">
                <div className="activity-main">
                  <span className="activity-desc">
                    {s.from_user === me.id ? 'You' : nameOf(s.from_user)} paid{' '}
                    {s.to_user === me.id ? 'you' : nameOf(s.to_user)}
                    {s.note ? ` \u00B7 ${s.note}` : ''}
                  </span>
                  <span className="activity-meta">{prettySettleDate(s.created_at)}</span>
                </div>
                <span className="money">{fmtMoney(s.amount, group.currency)}</span>
              </li>
            ))}
          </ul>
        )}
        {settlements.length > 0 && (
          <p className="hint">
            Total settled: <strong>{fmtMoney(settlements.reduce((sum, s) => sum + Number(s.amount), 0), group.currency)}</strong>
            {' across '}{settlements.length} payment{settlements.length === 1 ? '' : 's'}
          </p>
        )}
      </section>
    </div>
  )
}

function prettySettleDate(iso) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
