import { useState } from 'react'
import { Check, ChevronDown, LogOut, Pencil, X } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { fmtMoney } from '../lib/balances'
import { useToast } from './Toast'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'

export default function Profile({ me, groups, expenses, settlements, currency, onProfileUpdated }) {
  const [editing, setEditing] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [upiValue, setUpiValue] = useState(me.upi_id || '')
  const [upiBusy, setUpiBusy] = useState(false)

  async function saveUpi() {
    const cleaned = upiValue.trim()
    if (cleaned && !/^[a-zA-Z0-9.\-_]{2,}@[a-zA-Z]{2,}$/.test(cleaned)) {
      toast('error', 'That doesn\u2019t look like a UPI ID (e.g. name@okhdfcbank).')
      return
    }
    setUpiBusy(true)
    const { error } = await supabase.from('profiles').update({ upi_id: cleaned || null }).eq('id', me.id)
    setUpiBusy(false)
    if (error) { toast('error', error.message); return }
    toast('success', cleaned ? 'UPI ID saved.' : 'UPI ID removed.')
    onProfileUpdated?.()
  }
  const [name, setName] = useState(me.full_name)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const initials = (me.full_name || '?')
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  // Quick stats for the active group
  const paidByMe = expenses.filter((e) => e.paid_by === me.id)
  const totalPaid = paidByMe.reduce((sum, e) => sum + Number(e.amount), 0)
  const myShare = expenses.reduce((sum, e) => {
    const split = e.splits?.find((s) => s.user_id === me.id)
    return sum + (split ? Number(split.amount) : 0)
  }, 0)
  const settlementsInvolvingMe = settlements.filter(
    (s) => s.from_user === me.id || s.to_user === me.id
  )

  async function saveName() {
    const trimmed = name.trim()
    if (!trimmed) { toast('error', 'Name can\u2019t be empty.'); return }
    if (trimmed === me.full_name) { setEditing(false); return }
    setBusy(true)
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: trimmed })
      .eq('id', me.id)
    setBusy(false)
    if (error) { toast('error', error.message); return }
    setEditing(false)
    toast('success', 'Name updated.')
    onProfileUpdated()
  }

  return (
    <div className="page">
      <section className="card profile-card">
        <div className="profile-avatar" aria-hidden="true">{initials}</div>

        {editing ? (
          <div className="profile-name-edit">
            <Label htmlFor="profile-name" className="sr-only">Your name</Label>
            <Input
              id="profile-name"
              type="text"
              value={name}
              autoFocus
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveName()}
            />
            <Button size="icon" onClick={saveName} disabled={busy} aria-label="Save name">
              <Check size={16} />
            </Button>
            <Button size="icon" variant="outline" onClick={() => { setEditing(false); setName(me.full_name) }} aria-label="Cancel">
              <X size={16} />
            </Button>
          </div>
        ) : (
          <div className="profile-name-row">
            <h2 className="profile-name">{me.full_name}</h2>
            <Button
              size="icon"
              variant="ghost"
              className="profile-edit-btn"
              onClick={() => setEditing(true)}
              title="Edit name"
              aria-label="Edit name"
            >
              <Pencil size={14} />
            </Button>
          </div>
        )}

        <p className="profile-email">{me.email}</p>
        <p className="hint">Your name change shows up for everyone, in every group.</p>
        <p className="hint">
          Member since {new Date(me.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
          {' · '}{groups.length} group{groups.length === 1 ? '' : 's'}
        </p>
      </section>

      <section className="card">
        <h2 className="card-title">UPI ID</h2>
        <p className="hint">Optional. Flatmates see this on the Settle screen so they can pay you with one tap.</p>
        <div className="field-row">
          <label className="field">
            <span className="sr-only">UPI ID</span>
            <Input
              value={upiValue}
              onChange={(e) => setUpiValue(e.target.value)}
              placeholder="yourname@okicici"
              autoCapitalize="none"
              autoCorrect="off"
            />
          </label>
          <Button onClick={saveUpi} disabled={upiBusy || (upiValue.trim() === (me.upi_id || ''))}>
            {upiBusy ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </section>

      <section className="card">
        <button
          type="button"
          className="month-header clickable-header"
          onClick={() => setShowStats((v) => !v)}
          aria-expanded={showStats}
        >
          <span className="month-title-wrap">
            <ChevronDown size={16} className={`month-chevron ${showStats ? '' : 'closed'}`} />
            <span className="month-title">Your numbers in this group</span>
          </span>
        </button>
        {showStats && (
          <ul className="ledger">
            <li className="ledger-row">
              <span className="ledger-name">Expenses you paid</span>
              <span className="money">{fmtMoney(totalPaid, currency)} <span className="pct">({paidByMe.length})</span></span>
            </li>
            <li className="ledger-row">
              <span className="ledger-name">Your total share</span>
              <span className="money">{fmtMoney(myShare, currency)}</span>
            </li>
            <li className="ledger-row">
              <span className="ledger-name">Payments involving you</span>
              <span className="money">{settlementsInvolvingMe.length}</span>
            </li>
          </ul>
        )}
      </section>

      <section className="card">
        <h2 className="card-title">Groups</h2>
        <ul className="ledger">
          {groups.map((g) => (
            <li key={g.id} className="ledger-row">
              <span className="ledger-name">
                {g.name}
                {g.created_by === me.id && <Badge variant="secondary">admin</Badge>}
              </span>
              <span className="activity-meta">{g.currency}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <Button variant="outline" className="block" onClick={() => supabase.auth.signOut()}>
          <LogOut size={15} /> Sign out
        </Button>
      </section>
    </div>
  )
}
