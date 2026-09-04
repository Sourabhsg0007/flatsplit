// The "money personality" engine: turns a list of personal expenses into
// an archetype + readable traits. Pure function, runs on-device, no AI —
// just honest arithmetic about where the money went.

const DISCRETIONARY = ['Food & Groceries', 'Entertainment', 'Shopping']
const FIXED = ['Rent', 'Utilities', 'Subscriptions']

const ARCHETYPES = {
  starter: { emoji: '🌱', name: 'Just Getting Started', blurb: 'Not enough data yet — add or import more expenses and your money personality will take shape.' },
  foodie: { emoji: '🍜', name: 'The Foodie', blurb: 'Food is the main character of your spending story. Swiggy probably knows your address better than your friends do.' },
  explorer: { emoji: '🧭', name: 'The Explorer', blurb: 'A big slice of your money goes into moving — cabs, trains, fuel, trips. You spend on going places, literally.' },
  retail: { emoji: '🛍️', name: 'The Retail Therapist', blurb: 'Shopping carries your spending. Deliveries at the door are a love language.' },
  collector: { emoji: '📺', name: 'The Subscription Collector', blurb: 'A notable chunk goes to subscriptions. Quick audit: how many are you actually using this month?' },
  weekender: { emoji: '🎉', name: 'The Weekend Warrior', blurb: 'Your wallet works weekends. Monday to Friday you save; Saturday and Sunday you live.' },
  nester: { emoji: '🏠', name: 'The Steady Nester', blurb: 'Most of your money goes to fixed essentials — rent, utilities, subscriptions. Predictable, stable, sorted.' },
  sprinter: { emoji: '⚡', name: 'The Impulse Sprinter', blurb: 'Lots of small, frequent spends rather than a few big ones. Individually tiny — together, a story.' },
  balanced: { emoji: '⚖️', name: 'The Balanced All-Rounder', blurb: 'No single category dominates. Your spending is spread out and, honestly, quite disciplined.' },
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function analyzePersonality(items) {
  const spends = (items || []).filter((i) => Number(i.amount) > 0)
  if (spends.length < 5) {
    return { archetype: ARCHETYPES.starter, traits: [], total: 0, enough: false }
  }

  const total = spends.reduce((s, i) => s + Number(i.amount), 0)

  // category shares
  const byCat = {}
  for (const i of spends) byCat[i.category] = (byCat[i.category] || 0) + Number(i.amount)
  const share = (cat) => (byCat[cat] || 0) / total
  const topCat = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0]

  // weekend share
  let weekendAmt = 0
  const byDay = [0, 0, 0, 0, 0, 0, 0]
  for (const i of spends) {
    const day = new Date(`${i.expense_date}T12:00:00`).getDay()
    byDay[day] += Number(i.amount)
    if (day === 0 || day === 6) weekendAmt += Number(i.amount)
  }
  const weekendShare = weekendAmt / total
  const busiestDay = DAY_NAMES[byDay.indexOf(Math.max(...byDay))]

  // impulse: share of transactions that are small discretionary spends
  const smallCount = spends.filter((i) => Number(i.amount) <= 250 && DISCRETIONARY.includes(i.category)).length
  const smallShare = smallCount / spends.length

  const fixedShare = FIXED.reduce((s, c) => s + share(c), 0)
  const avgTxn = total / spends.length
  const biggest = spends.reduce((max, i) => (Number(i.amount) > Number(max.amount) ? i : max), spends[0])

  // days covered → daily average
  const dates = spends.map((i) => i.expense_date).sort()
  const daysSpan = Math.max(1, Math.round((new Date(dates[dates.length - 1]) - new Date(dates[0])) / 86400000) + 1)

  // archetype: first strong signal wins
  let archetype = ARCHETYPES.balanced
  if (share('Food & Groceries') >= 0.35) archetype = ARCHETYPES.foodie
  else if (share('Transportation') >= 0.25) archetype = ARCHETYPES.explorer
  else if (share('Shopping') >= 0.3) archetype = ARCHETYPES.retail
  else if (share('Subscriptions') >= 0.15) archetype = ARCHETYPES.collector
  else if (weekendShare >= 0.45) archetype = ARCHETYPES.weekender
  else if (fixedShare >= 0.55) archetype = ARCHETYPES.nester
  else if (smallShare >= 0.5) archetype = ARCHETYPES.sprinter

  const pct = (x) => `${Math.round(x * 100)}%`
  const traits = [
    { label: 'Top category', value: topCat[0], detail: `${pct(topCat[1] / total)} of everything` },
    { label: 'Weekend spending', value: pct(weekendShare), detail: weekendShare >= 0.45 ? 'weekends hit hard' : weekendShare <= 0.2 ? 'weekdays do the damage' : 'fairly even through the week' },
    { label: 'Busiest day', value: busiestDay, detail: 'when the most money moves' },
    { label: 'Fixed vs flexible', value: `${pct(fixedShare)} fixed`, detail: 'rent, utilities & subscriptions' },
    { label: 'Typical transaction', value: null, amount: avgTxn, detail: `${spends.length} spends over ${daysSpan} day${daysSpan === 1 ? '' : 's'}` },
    { label: 'Biggest splurge', value: null, amount: Number(biggest.amount), detail: biggest.description?.slice(0, 42) || biggest.category },
  ]

  return { archetype, traits, total, enough: true, shares: byCat }
}
