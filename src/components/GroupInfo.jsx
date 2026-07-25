import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function GroupInfo({ group, me, members, groups, onSwitchGroup, onNewGroup }) {
  const [copied, setCopied] = useState(false)

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(group.invite_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      window.prompt('Copy this invite code:', group.invite_code)
    }
  }

  return (
    <div className="page">
      <section className="card">
        <h2 className="card-title">Invite flatmates</h2>
        <p className="hint">
          Ask them to sign up, choose “Join with code”, and enter this code:
        </p>
        <div className="invite-code" onClick={copyCode} role="button" tabIndex={0}>
          <span className="code">{group.invite_code}</span>
          <span className="copy-hint">{copied ? 'Copied!' : 'Tap to copy'}</span>
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">Members · {group.name}</h2>
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
