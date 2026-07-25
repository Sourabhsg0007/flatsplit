// All balance math lives here.
// Convention: positive net = this person is owed money; negative = they owe.

export function computeNetBalances(memberIds, expenses, settlements) {
  const net = {}
  memberIds.forEach((id) => (net[id] = 0))

  for (const e of expenses) {
    if (net[e.paid_by] !== undefined) net[e.paid_by] += Number(e.amount)
    for (const s of e.splits || []) {
      if (net[s.user_id] !== undefined) net[s.user_id] -= Number(s.amount)
    }
  }

  // Paying someone back increases your net and decreases the receiver's.
  for (const st of settlements) {
    if (net[st.from_user] !== undefined) net[st.from_user] += Number(st.amount)
    if (net[st.to_user] !== undefined) net[st.to_user] -= Number(st.amount)
  }

  for (const id of Object.keys(net)) net[id] = round2(net[id])
  return net
}

// Greedy debt simplification: minimal-ish set of transfers to settle everyone.
export function simplifyDebts(net) {
  const debtors = []
  const creditors = []
  for (const [id, v] of Object.entries(net)) {
    if (v < -0.009) debtors.push({ id, amt: -v })
    else if (v > 0.009) creditors.push({ id, amt: v })
  }
  debtors.sort((a, b) => b.amt - a.amt)
  creditors.sort((a, b) => b.amt - a.amt)

  const transfers = []
  let i = 0
  let j = 0
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amt, creditors[j].amt)
    transfers.push({ from: debtors[i].id, to: creditors[j].id, amount: round2(pay) })
    debtors[i].amt -= pay
    creditors[j].amt -= pay
    if (debtors[i].amt < 0.009) i++
    if (creditors[j].amt < 0.009) j++
  }
  return transfers
}

// Turn form inputs into resolved per-person amounts that sum exactly to total.
export function computeSplits(splitType, total, entries) {
  // entries: [{ user_id, value }] — value meaning depends on splitType
  const included = entries.filter((e) => e.included !== false)
  if (included.length === 0) throw new Error('Select at least one person to split with')
  const cents = Math.round(total * 100)

  if (splitType === 'equal') {
    const base = Math.floor(cents / included.length)
    let remainder = cents - base * included.length
    return included.map((e) => {
      const extra = remainder > 0 ? 1 : 0
      if (remainder > 0) remainder--
      return { user_id: e.user_id, amount: (base + extra) / 100 }
    })
  }

  if (splitType === 'exact') {
    const splits = included.map((e) => ({
      user_id: e.user_id,
      amount: round2(Number(e.value) || 0),
    }))
    const sum = Math.round(splits.reduce((a, s) => a + s.amount * 100, 0))
    if (sum !== cents) {
      throw new Error(
        `Amounts add up to ${(sum / 100).toFixed(2)}, but the total is ${total.toFixed(2)}`
      )
    }
    return splits
  }

  if (splitType === 'percent') {
    const pctSum = included.reduce((a, e) => a + (Number(e.value) || 0), 0)
    if (Math.abs(pctSum - 100) > 0.01) {
      throw new Error(`Percentages add up to ${pctSum}%, they need to total 100%`)
    }
    return allocateProportionally(cents, included, (e) => Number(e.value) || 0)
  }

  if (splitType === 'shares') {
    const shareSum = included.reduce((a, e) => a + (Number(e.value) || 0), 0)
    if (shareSum <= 0) throw new Error('Enter at least one share')
    return allocateProportionally(cents, included, (e) => Number(e.value) || 0)
  }

  throw new Error('Unknown split type')
}

// Largest-remainder allocation so paise never go missing.
function allocateProportionally(totalCents, entries, weightFn) {
  const totalWeight = entries.reduce((a, e) => a + weightFn(e), 0)
  const raw = entries.map((e) => (weightFn(e) / totalWeight) * totalCents)
  const floors = raw.map(Math.floor)
  let remainder = totalCents - floors.reduce((a, b) => a + b, 0)
  const order = raw
    .map((v, idx) => ({ idx, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac)
  for (const { idx } of order) {
    if (remainder <= 0) break
    floors[idx] += 1
    remainder -= 1
  }
  return entries.map((e, idx) => ({ user_id: e.user_id, amount: floors[idx] / 100 }))
}

export function round2(n) {
  return Math.round(n * 100) / 100
}

export function fmtMoney(n, currency = '₹') {
  const v = Math.abs(Number(n) || 0)
  return `${currency}${v.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}
