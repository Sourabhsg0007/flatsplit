import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function GroupInfo({ group, me, members, groups, onSwitchGroup, onNewGroup, onGroupUpdated }) {
  const [copied, setCopied] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [newName, setNewName] = useState(group.name)
  const [busy, setBusy] = useState(false)

  const inviteLink = `${window.location.origin}${window.location.pathname}?join=${group.invite_code}`

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(inviteLink)
      setCopied(true)
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
    if (error) { window.alert(error.message); return }
    setEditingName(false)
    if (onGroupUpdated) onGroupUpdated()
  }

  return (
    <div className="page">
      <section className="card">
        <h2 className="card-title">Invite flatmates</h2>
        <p className="hint">Share this link — they&rsquo;ll join automatically after signing in:</p>
        <div className="invite-code" onClick={copyLink} role="button" tabIndex={0}>
          <span className="code" style={{ fontSize: '0.9rem', letterSpacing: '0.05em' }}>{inviteLink}</span>
          <span className="copy-hint">{copied ? 'Copied!' : 'Tap to copy link'}</span>
        </div>
        <p className="hint" style={{ textAlign: 'center' }}>
          Or share the code: <strong>{group.invite_code}</strong>
        </p>
      </section>

      <section className="card">
        <h2 className="card-title">Group</h2>
        {editingName ? (
          <div className="field-row">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="field-input"
              onKeyDown={(e) => e.key === 'Enter' && saveName()}
              autoFocus
            />
            <button className="btn small" onClick={saveName} disabled={busy}>
              Save
            </button>
            <button className="btn small" onClick={() => { setEditingName(false); setNewName(group.name) }}>
              Cancel
            </button>
          </div>
        ) : (
          <div className="group-name-row">
            <span className="group-name-text">{group.name}</span>
            <button className="btn small" onClick={() => { setEditingName(true); setNewName(group.name) }}>
              Edit
            </button>
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="card-title">Members</h2>
        <ul className="ledger">
          {members.map((m) => (
            <li key={m.id} className="ledger-row">
              <span className="ledger-name">
                {m.full_name}
                {m.id === me.id && <em className="you-tag">you</em>}
              </span>
              <span className="activity-meta">{m.email || ''}</span>
            </li>
          ))}
        </ul>
      </section>

      {groups.length > 1 && (
        <section className="card">
          <h2 className="card-title">Switch group</h2>
          <select
            className="block-select"
            value={group.id}
            onChange={(e) => onSwitchGroup(e.target.value)}
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </section>
      )}

      <section className="card">
        <button className="btn ghost block" onClick={onNewGroup}>
          Create or join another group
        </button>
        <button className="btn link block" onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </section>
    </div>
  )
}