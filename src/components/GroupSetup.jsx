import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { Alert, AlertDescription } from './ui/alert'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Tabs, TabsList, TabsTrigger } from './ui/tabs'

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

        <Tabs value={tab} onValueChange={(value) => { setTab(value); setError(null) }}>
          <TabsList>
            <TabsTrigger value="create">Create a group</TabsTrigger>
            <TabsTrigger value="join">Join with code</TabsTrigger>
          </TabsList>
        </Tabs>

        {tab === 'create' ? (
          <>
            <label className="field">
              <Label htmlFor="group-name">Group name</Label>
              <Input
                id="group-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. 402, Green Residency"
              />
            </label>
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            <Button className="block" onClick={createGroup} disabled={busy}>
              {busy ? 'Creating…' : 'Create group'}
            </Button>
          </>
        ) : (
          <>
            <label className="field">
              <Label htmlFor="invite-code">Invite code</Label>
              <Input
                id="invite-code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="6-character code"
                maxLength={6}
                style={{ textTransform: 'uppercase', letterSpacing: '0.2em' }}
              />
            </label>
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            <Button className="block" onClick={joinGroup} disabled={busy}>
              {busy ? 'Joining…' : 'Join group'}
            </Button>
          </>
        )}

        <Button className="block" variant="link" onClick={onSignOut}>Sign out</Button>
      </div>
    </div>
  )
}
