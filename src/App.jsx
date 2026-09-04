import { useCallback, useEffect, useState } from 'react'
import { BarChart3, Home, List, Moon, Plus, Settings, Sun, UserRound, Wallet } from 'lucide-react'
import { supabase } from './supabaseClient'
import Auth from './components/Auth'
import Splash from './components/Splash'
import GroupSetup from './components/GroupSetup'
import Balances from './components/Balances'
import AddExpense from './components/AddExpense'
import Activity from './components/Activity'
import Insights from './components/Insights'
import Settle from './components/Settle'
import GroupInfo from './components/GroupInfo'
import Profile from './components/Profile'
import Personal from './components/Personal'
import { useToast } from './components/Toast'
import { Button } from './components/ui/button'
import { Skeleton } from './components/ui/skeleton'

export default function App() {
  const [session, setSession] = useState(undefined)
  const [splashDone, setSplashDone] = useState(false)
  const [profile, setProfile] = useState(null)
  const [groups, setGroups] = useState([])
  const [activeGroupId, setActiveGroupId] = useState(null)
  const [members, setMembers] = useState([])
  const [allMembers, setAllMembers] = useState([])
  const [expenses, setExpenses] = useState([])
  const [settlements, setSettlements] = useState([])
  const [tab, setTab] = useState('balances')
  const [showSetup, setShowSetup] = useState(false)
  const [loading, setLoading] = useState(true)
  const [expenseToEdit, setExpenseToEdit] = useState(null)
  const [repeatOf, setRepeatOf] = useState(null)
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('flatsplit-theme')
      if (saved) return saved === 'dark'
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return false
  })
  const toast = useToast()

  // Show the branded splash for at least a beat on app start.
  useEffect(() => {
    const t = setTimeout(() => setSplashDone(true), 1600)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
    window.localStorage.setItem('flatsplit-theme', darkMode ? 'dark' : 'light')
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', darkMode ? '#1A1F1D' : '#21312A')
  }, [darkMode])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tabParam = params.get('tab')
    if (tabParam && ['balances', 'activity', 'insights', 'add', 'settle', 'group', 'profile', 'personal'].includes(tabParam)) {
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
      supabase.from('group_members').select('group:groups(*)').eq('user_id', session.user.id).is('left_at', null),
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
        .select('user_id, left_at, profile:profiles(id, full_name, email, upi_id)')
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
    const memProfiles = (mems || []).map((m) => ({ ...m.profile, left_at: m.left_at })).filter(Boolean)
    setAllMembers(memProfiles)
    setMembers(memProfiles.filter((m) => !m.left_at))
    setExpenses(exps || [])
    setSettlements(setts || [])
  }, [activeGroupId])

  useEffect(() => {
    loadGroupData()
  }, [loadGroupData])

  // Auto-add any recurring bills that came due (rent, Wi-Fi, ...).
  // The RPC is idempotent, so calling it on every group load is safe.
  useEffect(() => {
    if (!activeGroupId) return
    supabase.rpc('generate_due_recurring', { gid: activeGroupId }).then(({ data, error }) => {
      if (!error && data > 0) {
        toast('success', `${data} recurring bill${data === 1 ? '' : 's'} added automatically.`)
        loadGroupData()
      }
    })
  }, [activeGroupId, loadGroupData, toast])

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
  if (!splashDone || session === undefined) {
    return <Splash />
  }

  if (session && loading) {
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
        <Button
          variant="ghost"
          size="icon"
          className={tab === 'profile' ? 'topbar-icon active' : 'topbar-icon'}
          type="button"
          onClick={() => setTab('profile')}
          title="Your profile"
          aria-label="Your profile"
        >
          <UserRound size={18} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="topbar-icon"
          type="button"
          onClick={() => setTab('group')}
          title="Group settings"
          aria-label="Group settings"
        >
          <Settings size={18} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="topbar-icon"
          type="button"
          onClick={() => setDarkMode((d) => !d)}
          title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </Button>
      </header>

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
        <button className={tab === 'personal' ? 'tab active' : 'tab'} onClick={() => setTab('personal')}>
          <span className="tab-icon"><Wallet size={20} /></span>Personal
        </button>
      </nav>

      <main className="content" key={tab}>
        {tab === 'balances' && (
          <Balances
            me={profile}
            members={allMembers}
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
            members={allMembers}
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
            onGroupUpdated={loadProfileAndGroups}
            onDataChanged={loadGroupData}
          />
        )}
        {tab === 'profile' && (
          <Profile
            me={profile}
            groups={groups}
            expenses={expenses}
            settlements={settlements}
            currency={group.currency}
            onProfileUpdated={() => { loadProfileAndGroups(); loadGroupData() }}
          />
        )}
        {tab === 'personal' && (
          <Personal me={profile} groups={groups} currency={group.currency} />
        )}
      </main>

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
          <Skeleton className="hero-balance skeleton-block" />
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
