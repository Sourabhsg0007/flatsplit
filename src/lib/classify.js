// Keyword classifier for Indian bank statement narrations → app categories.
// Rules run on-device; unknown merchants fall through to 'Other'.

const RULES = [
  { cat: 'Rent', words: ['rent', 'nobroker pay', 'landlord', 'lease'] },
  { cat: 'Food & Groceries', words: [
    'swiggy', 'zomato', 'eatsure', 'dominos', 'pizza', 'mcdonald', 'kfc', 'burger',
    'cafe', 'restaurant', 'biryani', 'dhaba', 'bakery', 'chai',
    'blinkit', 'zepto', 'instamart', 'bigbasket', 'grofers', 'dmart', 'd-mart',
    'more retail', 'reliance fresh', 'nature basket', 'milk', 'grocery', 'kirana', 'supermarket',
  ] },
  { cat: 'Transportation', words: [
    'uber', 'ola', 'rapido', 'irctc', 'redbus', 'abhibus', 'makemytrip', 'goibibo',
    'cleartrip', 'indigo', 'air india', 'vistara', 'spicejet', 'akasa', 'metro',
    'bmtc', 'best undertaking', 'fastag', 'petrol', 'fuel', 'hpcl', 'iocl', 'bpcl', 'shell',
  ] },
  { cat: 'Utilities', words: [
    'electricity', 'bescom', 'tneb', 'msedcl', 'bses', 'tata power', 'adani electricity',
    'water bill', 'bwssb', 'gas', 'indane', 'bharatgas', 'hp gas', 'png bill',
    'jio', 'airtel', 'vi recharge', 'vodafone', 'bsnl', 'act fibernet', 'hathway',
    'broadband', 'wifi', 'dth', 'tata play', 'postpaid', 'prepaid recharge',
  ] },
  { cat: 'Subscriptions', words: [
    'netflix', 'spotify', 'hotstar', 'prime video', 'amazon prime', 'sonyliv', 'zee5',
    'youtube premium', 'apple.com', 'apple services', 'google one', 'google play',
    'icloud', 'jiosaavn', 'gaana', 'audible', 'kindle unlimited', 'linkedin premium', 'chatgpt', 'claude.ai',
  ] },
  { cat: 'Entertainment', words: [
    'bookmyshow', 'pvr', 'inox', 'cinepolis', 'district', 'paytm movies', 'steam', 'playstation',
    'xbox', 'epic games', 'gaming', 'bowling', 'snooker', 'club', 'brewery', 'pub', 'bar ',
  ] },
  { cat: 'Shopping', words: [
    'amazon', 'flipkart', 'myntra', 'ajio', 'nykaa', 'meesho', 'snapdeal', 'tatacliq',
    'croma', 'reliance digital', 'vijay sales', 'decathlon', 'ikea', 'lifestyle', 'westside',
    'zara', 'h&m', 'uniqlo', 'shoppers stop', 'pantaloons', 'max fashion', 'trends',
  ] },
  { cat: 'Health', words: [
    'pharmacy', 'pharmeasy', 'netmeds', '1mg', 'tata 1mg', 'medplus', 'apollo', 'practo',
    'hospital', 'clinic', 'diagnostic', 'lab test', 'cult.fit', 'cultfit', 'gym', 'fitness',
    'dental', 'optical', 'lenskart',
  ] },
]

export function classify(description) {
  const d = String(description || '').toLowerCase()
  for (const rule of RULES) {
    for (const w of rule.words) if (d.includes(w)) return rule.cat
  }
  return 'Other'
}

export function classifyAll(transactions) {
  return transactions.map((t) => ({ ...t, category: classify(t.description) }))
}
