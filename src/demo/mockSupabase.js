// Demo-mode Supabase mock — same API surface the app uses, backed by
// in-memory data. Only used by the preview build (vite.demo.config.js).
 

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2))
const now = () => new Date().toISOString()

const ASHA = '11111111-1111-1111-1111-111111111111'
const ROHAN = '22222222-2222-2222-2222-222222222222'
const MEERA = '33333333-3333-3333-3333-333333333333'
const GROUP = 'aaaaaaaa-0000-0000-0000-000000000001'

const eq3 = (total) => {
  const cents = Math.round(total * 100)
  const base = Math.floor(cents / 3)
  let rem = cents - base * 3
  return [ASHA, ROHAN, MEERA].map((user_id) => {
    const extra = rem > 0 ? 1 : 0
    if (rem > 0) rem--
    return { user_id, amount: (base + extra) / 100 }
  })
}

const exp = (description, amount, paid_by, expense_date, category, splits) => ({
  id: uid(),
  group_id: GROUP,
  description,
  amount,
  paid_by,
  split_type: 'equal',
  category,
  expense_date,
  created_at: expense_date + 'T10:00:00Z',
  created_by: paid_by,
  splits: splits || eq3(amount),
})

const db = {
  profiles: [
    { id: ASHA, full_name: 'Asha', email: 'asha@example.com', upi_id: null, created_at: '2026-05-02T08:00:00Z' },
    { id: ROHAN, full_name: 'Rohan', email: 'rohan@example.com', upi_id: 'rohan@okaxis', created_at: '2026-05-02T09:00:00Z' },
    { id: MEERA, full_name: 'Meera', email: 'meera@example.com', created_at: '2026-05-03T10:00:00Z' },
  ],
  groups: [
    { id: GROUP, name: 'Flat 4B', currency: '₹', invite_code: 'DEMO42', created_by: ASHA, created_at: '2026-05-02T08:05:00Z', deleted_at: null },
  ],
  group_members: [
    { group_id: GROUP, user_id: ASHA, left_at: null },
    { group_id: GROUP, user_id: ROHAN, left_at: null },
    { group_id: GROUP, user_id: MEERA, left_at: null },
  ],
  expenses: [
    exp('Rent (auto)', 30000, ROHAN, '2026-08-01', 'Rent'),
    exp('Wi-Fi bill', 1200, MEERA, '2026-08-03', 'Utilities'),
    exp('Big grocery run', 3400, ASHA, '2026-08-08', 'Food & Groceries'),
    exp('Zomato Friday', 960, ROHAN, '2026-08-14', 'Food & Groceries'),
    exp('Electricity', 2100, ASHA, '2026-08-18', 'Utilities'),
    exp('Movie night', 1050, MEERA, '2026-08-22', 'Entertainment'),
    exp('July rent', 30000, ROHAN, '2026-07-01', 'Rent'),
    exp('July groceries', 2400, ASHA, '2026-07-05', 'Food & Groceries'),
    exp('Gas cylinder', 1100, MEERA, '2026-07-12', 'Utilities'),
    exp('House party snacks', 1800, ASHA, '2026-07-26', 'Entertainment'),
  ],
  settlements: [
    { id: uid(), group_id: GROUP, from_user: ASHA, to_user: ROHAN, amount: 9200, note: 'GPay', created_by: ASHA, created_at: '2026-07-30T18:00:00Z' },
    { id: uid(), group_id: GROUP, from_user: MEERA, to_user: ROHAN, amount: 4000, note: 'Cash', created_by: MEERA, created_at: '2026-08-10T12:00:00Z' },
  ],
  recurring_expenses: [
    { id: uid(), group_id: GROUP, description: 'Rent', amount: 30000, paid_by: ROHAN, category: 'Rent', day_of_month: 1, splits: eq3(30000), next_due: '2026-09-01', active: true, created_by: ASHA, created_at: '2026-06-01T08:00:00Z' },
    { id: uid(), group_id: GROUP, description: 'Maid', amount: 1500, paid_by: ASHA, category: 'Other', day_of_month: 5, splits: eq3(1500), next_due: '2026-09-05', active: true, created_by: ASHA, created_at: '2026-06-01T08:10:00Z' },
  ],
  expense_comments: [],
  expense_reactions: [],
  personal_expenses: [
    { id: uid(), user_id: ASHA, description: 'Chai', amount: 20, category: 'Food & Groceries', expense_date: '2026-08-29', created_at: now() },
    { id: uid(), user_id: ASHA, description: 'Auto to office', amount: 85, category: 'Transportation', expense_date: '2026-08-28', created_at: now() },
    { id: uid(), user_id: ASHA, description: 'Movie snacks', amount: 240, category: 'Entertainment', expense_date: '2026-08-22', created_at: now() },
    { id: uid(), user_id: ASHA, description: 'Gym protein', amount: 1400, category: 'Health', expense_date: '2026-08-20', created_at: now() },
    { id: uid(), user_id: ASHA, description: 'Paperback', amount: 499, category: 'Shopping', expense_date: '2026-08-15', created_at: now() },
    { id: uid(), user_id: ASHA, description: 'Coffee with Nikhil', amount: 380, category: 'Food & Groceries', expense_date: '2026-07-22', created_at: now() },
    { id: uid(), user_id: ASHA, description: 'Haircut', amount: 300, category: 'Other', expense_date: '2026-07-18', created_at: now() },
  ],
}

// seed a couple of comments/reactions on "Zomato Friday" and "Movie night"
const zomato = db.expenses.find((e) => e.description === 'Zomato Friday')
const movie = db.expenses.find((e) => e.description === 'Movie night')
db.expense_comments.push(
  { id: uid(), expense_id: zomato.id, user_id: ASHA, body: 'what did we even order 😅', created_at: '2026-08-14T21:00:00Z' },
  { id: uid(), expense_id: zomato.id, user_id: ROHAN, body: 'the biryani. worth it.', created_at: '2026-08-14T21:05:00Z' },
)
db.expense_reactions.push(
  { expense_id: zomato.id, user_id: MEERA, emoji: '😂', created_at: now() },
  { expense_id: zomato.id, user_id: ASHA, emoji: '👍', created_at: now() },
  { expense_id: movie.id, user_id: ROHAN, emoji: '🔥', created_at: now() },
)

// ---------- tiny query builder ----------
function matches(row, filters) {
  return filters.every(({ k, v }) => (v === null ? row[k] == null : row[k] === v))
}

class Builder {
  constructor(table) {
    this.table = table
    this.op = 'select'
    this.filters = []
    this.sel = '*'
    this.isSingle = false
    this.payload = null
  }
  select(sel) { if (sel) this.sel = sel; return this }
  eq(k, v) { this.filters.push({ k, v }); return this }
  is(k, v) { this.filters.push({ k, v }); return this }
  match(obj) { for (const [k, v] of Object.entries(obj)) this.filters.push({ k, v }); return this }
  order() { return this }
  single() { this.isSingle = true; return this }
  insert(p) { this.op = 'insert'; this.payload = p; return this }
  upsert(p, opts) { this.op = 'upsert'; this.payload = p; this.upsertOpts = opts; return this }
  update(p) { this.op = 'update'; this.payload = p; return this }
  delete() { this.op = 'delete'; return this }

  exec() {
    const rows = db[this.table] || []
    if (this.op === 'insert' || this.op === 'upsert') {
      const items = Array.isArray(this.payload) ? this.payload : [this.payload]
      const inserted = []
      for (const item of items) {
        if (this.op === 'upsert' && item.import_hash) {
          const dupe = db[this.table].some((r) => r.user_id === item.user_id && r.import_hash === item.import_hash)
          if (dupe) continue
        }
        const row = { id: uid(), created_at: now(), ...item }
        db[this.table].push(row)
        inserted.push({ ...row })
      }
      return { data: this.op === 'upsert' ? inserted : null, error: null }
    }
    if (this.op === 'update') {
      for (const row of rows) if (matches(row, this.filters)) Object.assign(row, this.payload)
      return { data: null, error: null }
    }
    if (this.op === 'delete') {
      db[this.table] = rows.filter((row) => !matches(row, this.filters))
      return { data: null, error: null }
    }
    // select
    let out = rows.filter((row) => matches(row, this.filters))
    if (this.table === 'group_members' && this.sel.includes('group:groups')) {
      out = out.map((m) => ({ ...m, group: db.groups.find((g) => g.id === m.group_id) }))
    }
    if (this.table === 'group_members' && this.sel.includes('profile:profiles')) {
      out = out.map((m) => ({ ...m, profile: db.profiles.find((p) => p.id === m.user_id) }))
    }
    if (this.table === 'expenses') {
      out = [...out].sort((a, b) => (a.expense_date < b.expense_date ? 1 : -1))
    }
    if (this.table === 'settlements' || this.table === 'expense_comments') {
      out = [...out].sort((a, b) => (this.table === 'expense_comments'
        ? (a.created_at < b.created_at ? -1 : 1)
        : (a.created_at < b.created_at ? 1 : -1)))
    }
    if (this.table === 'personal_expenses') {
      out = [...out].filter((r) => r.user_id === ASHA)
        .sort((a, b) => (a.expense_date < b.expense_date ? 1 : -1))
    }
    out = out.map((r) => ({ ...r }))
    return this.isSingle ? { data: out[0] ?? null, error: null } : { data: out, error: null }
  }
  then(resolve, reject) { return Promise.resolve(this.exec()).then(resolve, reject) }
}

// ---------- rpc handlers ----------
const rpcs = {
  add_expense({ gid, descr, total, payer, edate, stype, splits, cat }) {
    db.expenses.push({
      id: uid(), group_id: gid, description: descr, amount: total, paid_by: payer,
      split_type: stype, category: cat || 'Other', expense_date: edate,
      created_at: now(), created_by: ASHA,
      splits: splits.map((s) => ({ user_id: s.user_id, amount: Number(s.amount) })).filter((s) => s.amount > 0),
    })
    return { data: null, error: null }
  },
  update_expense({ eid, descr, total, payer, edate, stype, cat, splits }) {
    const e = db.expenses.find((x) => x.id === eid)
    if (!e) return { data: null, error: { message: 'Expense not found' } }
    Object.assign(e, {
      description: descr, amount: total, paid_by: payer, expense_date: edate,
      split_type: stype, category: cat,
      splits: splits.map((s) => ({ user_id: s.user_id, amount: Number(s.amount) })).filter((s) => s.amount > 0),
    })
    return { data: null, error: null }
  },
  generate_due_recurring() { return { data: 0, error: null } },
  join_group() { return { data: GROUP, error: null } },
}

export const supabase = {
  auth: {
    // Stateful demo auth: sign out really shows the login screen, and any
    // sign-in path brings the demo session back. Nothing is persisted.
    _session: { user: { id: ASHA, email: 'asha@example.com' } },
    _listeners: [],
    _emit(event) {
      for (const cb of this._listeners) cb(event, this._session)
    },
    async getSession() {
      return { data: { session: this._session } }
    },
    onAuthStateChange(cb) {
      this._listeners.push(cb)
      const self = this
      return { data: { subscription: { unsubscribe() { self._listeners = self._listeners.filter((c) => c !== cb) } } } }
    },
    async signOut() {
      this._session = null
      this._emit('SIGNED_OUT')
      return { error: null }
    },
    async signInWithPassword() {
      this._session = { user: { id: ASHA, email: 'asha@example.com' } }
      this._emit('SIGNED_IN')
      return { data: { session: this._session }, error: null }
    },
    async signUp() {
      this._session = { user: { id: ASHA, email: 'asha@example.com' } }
      this._emit('SIGNED_IN')
      return { data: { user: this._session.user, session: this._session }, error: null }
    },
    async signInWithOAuth() {
      this._session = { user: { id: ASHA, email: 'asha@example.com' } }
      this._emit('SIGNED_IN')
      return { data: {}, error: null }
    },
  },
  from(table) { return new Builder(table) },
  async rpc(name, args = {}) {
    const handler = rpcs[name]
    if (!handler) return { data: null, error: { message: `${name} is not available in this demo preview` } }
    return handler(args)
  },
  channel() {
    const chain = { on() { return chain }, subscribe() { return chain } }
    return chain
  },
  removeChannel() {},
}
