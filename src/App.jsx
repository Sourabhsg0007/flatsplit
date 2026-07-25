import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Auth from './components/Auth'
import GroupSetup from './components/GroupSetup'
import Balances from './components/Balances'
import AddExpense from './components/AddExpense'
import Activity from './components/Activity'
import Settle from './components/Settle'
import GroupInfo from './components/GroupInfo'

export default function App() {
  const [session, setSession] = useState(undefined)
  const [profile, setProfile] = useState(null)
  const [groups, setGroups] = useState([])
  const [activeGroupId, setActiveGroupId] = useState(null)
  const [members, setMembers] = useState([])
  const [expenses, setExpenses] = useState([])
  const [settlements, setSettlements] = useState([])
  const [tab, setTab] = useState('balances')
  const [showSetup, setShowSetup] = useState(false)
  const [loading, setLoading] = useState(true)
  const [expenseToEdit, setExpenseToEdit] = useState(null)
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return false
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  // --- auth session ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  // --- profile + groups ---
  const loadProfileAndGroups = useCallback(async () => {
    if (!session?.user) return
    const [{ data: prof }, { data: memberships }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', session.user.id).single(),
      supabase.from('group_members').select('group:groups(*)').eq('user_id', session.user.id),
    ])
    setProfile(prof)
    const gs = (memberships || []).map((m) => m.group).filter(Boolean)
    setGroups(gs)
    setActiveGroupId((cur) => (cur && gs.some((g) => g.id === cur) ? cur : gs[0]?.id ?? null))
    setLoading(false)
  }, [session])

  useEffect(() => {
    if (session === undefined) return
    if (!session) { setLoading(false); return }
    setLoading(true)
    loadProfileAndGroups()
  }, [session, loadProfileAndGroups])

  // --- group data ---
  const loadGroupData = useCallback(async () => {
    if (!activeGroupId) return
    const [{ data: mems }, { data: exps }, { data: setts }] = await Promise.all([
      supabase
        .from('group_members')
        .select('user_id, profile:profiles(id, full_name, email)')
        .eq('group_id', activeGroupId),
      supabase
        .from('expenses')
        .select('*, splits:expense_splits(user_id, amount)')
        .eq('group_id', activeGroupId)
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase
        .from('settlements')
        .select('*')
        .eq('group_id', activeGroupId)
        .order('created_at', { ascending: false }),
    ])
    setMembers((mems || []).map((m) => m.profile).filter(Boolean))
    setExpenses(exps || [])
    setSettlements(setts || [])
  }, [activeGroupId])

  useEffect(() => {
    loadGroupData()
  }, [loadGroupData])

  // --- realtime: refetch when anyone in the flat changes something ---
  useEffect(() => {
    if (!activeGroupId) return
    const channel = supabase
      .channel(`group-${activeGroupId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expenses', filter: `group_id=eq.${activeGroupId}` },
        () => loadGroupData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'settlements', filter: `group_id=eq.${activeGroupId}` },
        () => loadGroupData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_members', filter: `group_id=eq.${activeGroupId}` },
        () => loadGroupData()
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [activeGroupId, loadGroupData])

  // Refetch when the tab regains focus (belt and braces for mobile).
  useEffect(() => {
    const onFocus = () => loadGroupData()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [loadGroupData])

  function handleEditExpense(expense) {
    setExpenseToEdit(expense)
    setTab('add')
  }

  function handleExpenseSaved() {
    setExpenseToEdit(null)
    loadGroupData()
    setTab('balances')
  }

  function handleExpenseCancelled() {
    setExpenseToEdit(null)
    setTab('balances')
  }

  // --- render states ---
  if (session === undefined || (session && loading)) {
    return <div className="splash"><span className="brand-mark big">{'÷'}</span></div>
  }

  if (!session) return <Auth />

  if (!profile) {
    return <div className="splash"><span className="brand-mark big">{'÷'}</span></div>
  }

  if (groups.length === 0 || showSetup) {
    return (
      <GroupSetup
        onDone={async (gid) => {
          setShowSetup(false)
          await loadProfileAndGroups()
          if (gid) setActiveGroupId(gid)
          setTab('balances')
        }}
        onSignOut={() => supabase.auth.signOut()}
      />
    )
  }

  const group = groups.find((g) => g.id === activeGroupId) || groups[0]

  return (
    <div className="app">
      <header className="topbar">
        <span className="topbar-brand">÷</span>
        <span className="topbar-title">{group.name}</span>
        <button
          className="dark-toggle"
          onClick={() => setDarkMode((d) => !d)}
          title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {darkMode ? '\u2600' : '\u263E'}
        </button>
      </header>

      <main className="content">
        {tab === 'balances' && (
          <Balances
            me={profile}
            members={members}
            expenses={expenses}
            settlements={settlements}
            currency={group.currency}
            onGoSettle={() => setTab('settle')}
          />
        )}
        {tab === 'activity' && (
          <Activity
            me={profile}
            members={members}
            expenses={expenses}
            settlements={settlements}
            currency={group.currency}
            onChanged={loadGroupData}
            onEditExpense={handleEditExpense}
          />
        )}
        {tab === 'add' && (
          <AddExpense
            group={group}
            me={profile}
            members={members}
            onSaved={handleExpenseSaved}
            onCancel={handleExpenseCancelled}
            expenseToEdit={expenseToEdit}
          />
        )}
        {tab === 'settle' && (
          <Settle
            group={group}
            me={profile}
            members={members}
            expenses={expenses}
            settlements={settlements}
            onSaved={() => { loadGroupData(); setTab('balances') }}
          />
        )}
        {tab === 'group' && (
          <GroupInfo
            group={group}
            me={profile}
            members={members}
            groups={groups}
            onSwitchGroup={(gid) => { setActiveGroupId(gid); setTab('balances') }}
            onNewGroup={() => setShowSetup(true)}
            onGroupUpdated={loadProfileAndGroups}
          />
        )}
      </main>

      <nav className="tabbar">
        <button className={tab === 'balances' ? 'tab active' : 'tab'} onClick={() => setTab('balances')}>
          <span className="tab-icon">⌂</span>Balances
        </button>
        <button className={tab === 'activity' ? 'tab active' : 'tab'} onClick={() => setTab('activity')}>
          <span className="tab-icon">≡</span>Activity
        </button>
        <button className="tab add-btn" onClick={() => { setExpenseToEdit(null); setTab('add') }} aria-label="Add expense">
          +
        </button>
        <button className={tab === 'settle' ? 'tab active' : 'tab'} onClick={() => setTab('settle')}>
          <span className="tab-icon">⇄</span>Settle
        </button>
        <button className={tab === 'group' ? 'tab active' : 'tab'} onClick={() => setTab('group')}>
          <span className="tab-icon">⌘</span>Group
        </button>
      </nav>
    </div>
  )
}