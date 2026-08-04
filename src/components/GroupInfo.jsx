import { useState } from 'react'
import { Check, Copy, Pencil } from 'lucide-react'
import { supabase } from '../supabaseClient'
import ConfirmDialog from './ConfirmDialog'
import { useToast } from './Toast'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'

const CURRENCIES = [
  { value: '₹', label: 'INR (₹)' },
  { value: '$', label: 'USD ($)' },
  { value: '€', label: 'EUR (€)' },
  { value: '£', label: 'GBP (£)' },
  { value: '¥', label: 'JPY (¥)' },
  { value: 'AED', label: 'AED' },
]

const otherMembers = (members, meId) => members.filter((m) => m.id !== meId)

export default function GroupInfo({ group, me, members, groups, onSwitchGroup, onGroupUpdated }) {
  const [copied, setCopied] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [newName, setNewName] = useState(group.name)
  const [currency, setCurrency] = useState(group.currency)
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const [showLeaveOptions, setShowLeaveOptions] = useState(false)
  const [leaveMode, setLeaveMode] = useState(null)
  const [newAdminId, setNewAdminId] = useState('')
  const [confirmTarget, setConfirmTarget] = useState(null)

  const isAdmin = group.created_by === me.id
  const others = otherMembers(members, me.id)
  const inviteLink = `${window.location.origin}${window.location.pathname}?join=${group.invite_code}`

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(inviteLink)
      setCopied(true)
      toast('success', 'Invite link copied.')
      setTimeout(() => setCopied(false), 1500)
    } catch {
      window.prompt('Copy this invite link:', inviteLink)
    }
  }

  async function saveName() {
    if (!newName.trim()) return
    setBusy(true)
    const { error } = await supabase
      .from('groups')
      .update({ name: newName.trim() })
      .eq('id', group.id)
    setBusy(false)
    if (error) { toast('error', error.message); return }
    setEditingName(false)
    toast('success', 'Group name updated.')
    if (onGroupUpdated) onGroupUpdated()
  }

  async function saveCurrency(next) {
    if (next === group.currency) return
    setCurrency(next)
    const { error } = await supabase
      .from('groups')
      .update({ currency: next })
      .eq('id', group.id)
    if (error) {
      setCurrency(group.currency)
      toast('error', error.message)
      return
    }
    toast('success', `Currency set to ${next}.`)
    if (onGroupUpdated) onGroupUpdated()
  }

  function handleRemoveMember(userId) {
    setConfirmTarget({
      title: 'Remove this member?',
      body: 'Their expense history stays in the group.',
      confirmLabel: 'Remove',
      action: 'remove',
      userId,
    })
  }

  function handleLeave() {
    setConfirmTarget({
      title: 'Leave this group?',
      body: 'Your expense history stays visible to others.',
      confirmLabel: 'Leave',
      action: 'leave',
    })
  }

  function handleTransferAndLeave() {
    if (!newAdminId) return
    setConfirmTarget({
      title: 'Transfer ownership and leave?',
      body: 'The new owner will take over this group.',
      confirmLabel: 'Transfer & leave',
      action: 'transfer',
    })
  }

  function handleDeleteGroup() {
    setConfirmTarget({
      title: 'Delete this group for everyone?',
      body: 'All data stays on record but is hidden.',
      confirmLabel: 'Delete group',
      action: 'delete',
    })
  }

  async function runConfirm() {
    if (!confirmTarget) return
    setBusy(true)
    const { action } = confirmTarget
    let error = null
    if (action === 'remove') {
      ;({ error } = await supabase.rpc('remove_member', { gid: group.id, target_user_id: confirmTarget.userId }))
    } else if (action === 'leave') {
      ;({ error } = await supabase.rpc('leave_group', { gid: group.id }))
    } else if (action === 'transfer') {
      ;({ error } = await supabase.rpc('transfer_and_leave', { gid: group.id, new_owner_id: newAdminId }))
    } else if (action === 'delete') {
      ;({ error } = await supabase.rpc('delete_group', { gid: group.id }))
    }
    setBusy(false)
    setConfirmTarget(null)
    if (error) {
      toast('error', error.message)
      return
    }
    toast('success', action === 'delete' ? 'Group deleted.' : 'Done.')
    if (onGroupUpdated) onGroupUpdated()
  }

  function renderLeaveSection() {
    if (!showLeaveOptions) {
      return (
        <Button variant="outline" className="block" onClick={() => setShowLeaveOptions(true)} disabled={busy}>
          Leave group
        </Button>
      )
    }

    if (isAdmin) {
      return (
        <div className="card" style={{ borderColor: 'var(--neg)' }}>
          <h2 className="card-title" style={{ color: 'var(--neg)' }}>Leave this group</h2>

          {leaveMode === null && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {others.length > 0 && (
                <Button variant="outline" className="block" onClick={() => setLeaveMode('transfer')}>
                  Transfer ownership & leave
                </Button>
              )}
              <Button variant="outline" className="block" onClick={() => setLeaveMode('delete')}>
                Delete group for everyone
              </Button>
              <Button variant="link" className="block" onClick={() => { setShowLeaveOptions(false); setLeaveMode(null) }}>
                Cancel
              </Button>
            </div>
          )}

          {leaveMode === 'transfer' && (
            <>
              <p className="hint">Choose who becomes the new owner:</p>
              <Select value={newAdminId} onValueChange={setNewAdminId}>
                <SelectTrigger><SelectValue placeholder="Select a member..." /></SelectTrigger>
                <SelectContent>{others.map((m) => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}</SelectContent>
              </Select>
              <div className="field-row" style={{ marginTop: '10px' }}>
                <Button variant="outline" className="block" onClick={() => { setLeaveMode(null); setNewAdminId('') }}>
                  Back
                </Button>
                <Button
                  className="block"
                  onClick={handleTransferAndLeave}
                  disabled={busy || !newAdminId}
                >
                  {busy ? 'Processing...' : 'Transfer & leave'}
                </Button>
              </div>
            </>
          )}

          {leaveMode === 'delete' && (
            <>
              <p className="hint" style={{ color: 'var(--neg)' }}>
                This hides the group and all its data for everyone.
              </p>
              <div className="field-row">
                <Button variant="outline" className="block" onClick={() => setLeaveMode(null)}>
                  Back
                </Button>
                <Button variant="destructive" className="block" onClick={handleDeleteGroup} disabled={busy}>
                  {busy ? 'Deleting...' : 'Delete group'}
                </Button>
              </div>
            </>
          )}
        </div>
      )
    }

    return (
      <Button variant="outline" className="block" onClick={handleLeave} disabled={busy}>
        {busy ? 'Leaving...' : 'Leave group'}
      </Button>
    )
  }

  return (
    <div className="page">
      <section className="card">
        <h2 className="card-title">Invite flatmates</h2>
        <p className="hint">Share this link &mdash; they&rsquo;ll join automatically after signing in:</p>
        <button className="invite-code" onClick={copyLink} type="button">
          <span className="code" style={{ fontSize: '0.9rem', letterSpacing: '0.05em' }}>{inviteLink}</span>
          <span className="copy-hint">{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied!' : 'Tap to copy link'}</span>
        </button>
        <p className="hint" style={{ textAlign: 'center' }}>
          Or share the code: <strong>{group.invite_code}</strong>
        </p>
      </section>

      <section className="card">
        <h2 className="card-title">Group</h2>
        {editingName ? (
          <div className="field-row">
            <Input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="field-input"
              onKeyDown={(e) => e.key === 'Enter' && saveName()}
              autoFocus
            />
            <Button size="sm" variant="outline" onClick={saveName} disabled={busy}>
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setEditingName(false); setNewName(group.name) }}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="group-name-row">
            <span className="group-name-text">{group.name}</span>
            {isAdmin && (
              <Button size="sm" variant="outline" onClick={() => { setEditingName(true); setNewName(group.name) }}>
                <Pencil size={12} /> Edit
              </Button>
            )}
          </div>
        )}

        <label className="field" style={{ marginTop: 12 }}>
          <Label htmlFor="group-currency">Currency</Label>
          <Select value={currency} onValueChange={saveCurrency}>
            <SelectTrigger id="group-currency"><SelectValue /></SelectTrigger>
            <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
          </Select>
        </label>
      </section>

      <section className="card">
        <h2 className="card-title">Members ({members.length})</h2>
        <ul className="ledger">
          {members.map((m) => (
            <li key={m.id} className="ledger-row">
              <span className="ledger-name">
                {m.full_name}
                {m.id === me.id && <em className="you-tag">you</em>}
                {group.created_by === m.id && (
                  <em className="you-tag" style={{ background: 'var(--pine)', color: '#fff', borderColor: 'var(--pine)' }}>admin</em>
                )}
              </span>
              <span className="activity-meta">{m.email || ''}</span>
              {isAdmin && m.id !== me.id && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleRemoveMember(m.id)}
                  disabled={busy}
                >
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {groups.length > 1 && (
        <section className="card">
          <h2 className="card-title">Switch group</h2>
          <Select value={group.id} onValueChange={onSwitchGroup}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
          </Select>
        </section>
      )}

      <section className="card">
        {renderLeaveSection()}
        <Button variant="link" className="block" onClick={() => supabase.auth.signOut()}>
          Sign out
        </Button>
      </section>

      {confirmTarget && (
        <ConfirmDialog
          title={confirmTarget.title}
          body={confirmTarget.body}
          confirmLabel={busy ? 'Working…' : confirmTarget.confirmLabel}
          onConfirm={runConfirm}
          onCancel={() => setConfirmTarget(null)}
        />
      )}
    </div>
  )
}
