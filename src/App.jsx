import { useCallback, useEffect, useState } from 'react'
import { ArrowLeftRight, BarChart3, Home, List, Moon, Plus, Settings, Sun } from 'lucide-react'
import { supabase } from './supabaseClient'
import Auth from './components/Auth'
import GroupSetup from './components/GroupSetup'
import Balances from './components/Balances'
import AddExpense from './components/AddExpense'
import Activity from './components/Activity'
import Insights from './components/Insights'
import Settle from './components/Settle'
import GroupInfo from './components/GroupInfo'
import { useToast } from './components/Toast'

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
  const [repeatOf, setRepeatOf] = useState(null)
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return false
  })
  const toast = useToast()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', darkMode ? '#1A1F1D' : '#21312A')
  }, [darkMode])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tabParam = params.get('tab')
    if (tabParam && ['balances', 'activity', 'insights', 'add', 'settle', 'group'].includes(tabParam)) {
      setTab(tabParam)
    }
    const joinCode = params.get('join')
    if (joinCode) {
      localStorage.setItem('pendingInviteCode', joinCode)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

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

  // Auto-join via invite link after auth
  useEffect(() => {
    const code = localStorage.getItem('pendingInviteCode')
    if (!code || !session?.user || loading) return
    localStorage.removeItem('pendingInviteCode')
    ;(async () => {
      const { data, error } = await supabase.rpc('join_group', { code })
      if (error) {
        toast('error', error.message.includes('Invalid') ? 'That invite link is invalid.' : error.message)
        return
      }
      await loadProfileAndGroups()
      if (data) setActiveGroupId(data)
      setTab('balances')
    })()
  }, [session, loading, loadProfileAndGroups, toast])

  // Refetch when the tab regains focus (belt and braces for mobile).
  useEffect(() => {
    const onFocus = () => loadGroupData()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [loadGroupData])

  function handleEditExpense(expense) {
    setRepeatOf(null)
    setExpenseToEdit(expense)
    setTab('add')
  }

  function handleRepeatExpense(expense) {
    setExpenseToEdit(null)
    setRepeatOf(expense)
    setTab('add')
  }

  function handleExpenseSaved() {
    setExpenseToEdit(null)
    setRepeatOf(null)
    loadGroupData()
    setTab('balances')
  }

  function handleExpenseCancelled() {
    setExpenseToEdit(null)
    setRepeatOf(null)
    setTab('balances')
  }

  function openAdd() {
    setExpenseToEdit(null)
    setRepeatOf(null)
    setTab('add')
  }

  // --- render states ---
  if (session === undefined || (session && loading)) {
    return <SkeletonScreen />
  }

  if (!session) return <Auth />

  if (!profile) {
    return <SkeletonScreen />
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
          className="topbar-icon"
          onClick={() => setTab('group')}
          title="Group settings"
          aria-label="Group settings"
        >
          <Settings size={18} />
        </button>
        <button
          className="topbar-icon"
          onClick={() => setDarkMode((d) => !d)}
          title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
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
            onAddExpense={openAdd}
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
            onRepeatExpense={handleRepeatExpense}
          />
        )}
        {tab === 'insights' && (
          <Insights
            me={profile}
            members={members}
            expenses={expenses}
            settlements={settlements}
            currency={group.currency}
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
            repeatOf={repeatOf}
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
          <span className="tab-icon"><Home size={20} /></span>Balances
        </button>
        <button className={tab === 'activity' ? 'tab active' : 'tab'} onClick={() => setTab('activity')}>
          <span className="tab-icon"><List size={20} /></span>Activity
        </button>
        <button className="tab add-btn" onClick={openAdd} aria-label="Add expense">
          <Plus size={26} />
        </button>
        <button className={tab === 'insights' ? 'tab active' : 'tab'} onClick={() => setTab('insights')}>
          <span className="tab-icon"><BarChart3 size={20} /></span>Insights
        </button>
        <button className={tab === 'settle' ? 'tab active' : 'tab'} onClick={() => setTab('settle')}>
          <span className="tab-icon"><ArrowLeftRight size={20} /></span>Settle
        </button>
      </nav>
    </div>
  )
}

function SkeletonScreen() {
  return (
    <div className="app">
      <header className="topbar">
        <span className="topbar-brand">÷</span>
        <span className="topbar-title">
          <span className="skeleton-text" style={{ width: '120px' }} />
        </span>
      </header>
      <main className="content">
        <div className="page">
          <div className="hero-balance skeleton-block" />
          <div className="card">
            <div className="skeleton-text" style={{ width: '60%' }} />
            <div className="skeleton-text" style={{ width: '80%' }} />
          </div>
          <div className="card">
            <div className="skeleton-text" style={{ width: '50%' }} />
            <div className="skeleton-line" />
            <div className="skeleton-line" />
            <div className="skeleton-line" />
          </div>
        </div>
      </main>
    </div>
  )
}
