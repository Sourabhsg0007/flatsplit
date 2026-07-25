import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function GroupSetup({ onDone, onSignOut }) {
  const [tab, setTab] = useState('create') // 'create' | 'join'
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function createGroup() {
    setError(null)
    if (!name.trim()) { setError('Give your flat a name.'); return }
    setBusy(true)
    const { data, error: err } = await supabase.rpc('create_group', {
      group_name: name.trim(),
    })
    setBusy(false)
    if (err) { setError(err.message); return }
    onDone(data)
  }

  async function joinGroup() {
    setError(null)
    if (!code.trim()) { setError('Enter the invite code your flatmate shared.'); return }
    setBusy(true)
    const { data, error: err } = await supabase.rpc('join_group', {
      code: code.trim(),
    })
    setBusy(false)
    if (err) {
      setError(err.message.includes('Invalid') ? 'That code didn’t match any group. Check it and try again.' : err.message)
      return
    }
    onDone(data)
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="brand">
          <span className="brand-mark">÷</span>
          <h1>Set up your flat</h1>
          <p className="brand-sub">One person creates the group, everyone else joins with the code.</p>
        </div>

        <div className="seg">
          <button className={tab === 'create' ? 'seg-btn active' : 'seg-btn'} onClick={() => { setTab('create'); setError(null) }}>
            Create a group
          </button>
          <button className={tab === 'join' ? 'seg-btn active' : 'seg-btn'} onClick={() => { setTab('join'); setError(null) }}>
            Join with code
          </button>
        </div>

        {tab === 'create' ? (
          <>
            <label className="field">
              <span>Group name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. 402, Green Residency"
                onKeyDown={(e) => e.key === 'Enter' && createGroup()}
              />
            </label>
            {error && <div className="notice error">{error}</div>}
            <button className="btn primary block" onClick={createGroup} disabled={busy}>
              {busy ? 'Creating…' : 'Create group'}
            </button>
          </>
        ) : (
          <>
            <label className="field">
              <span>Invite code</span>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="6-character code"
                maxLength={6}
                style={{ textTransform: 'uppercase', letterSpacing: '0.2em' }}
                onKeyDown={(e) => e.key === 'Enter' && joinGroup()}
              />
            </label>
            {error && <div className="notice error">{error}</div>}
            <button className="btn primary block" onClick={joinGroup} disabled={busy}>
              {busy ? 'Joining…' : 'Join group'}
            </button>
          </>
        )}

        <button className="btn link block" onClick={onSignOut}>Sign out</button>
      </div>
    </div>
  )
}
