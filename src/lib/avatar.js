// Deterministic avatar colors: the same person always gets the same hue,
// on every device, with readable contrast in light and dark mode.
// Inspired by people-first designs (Splitwise/Tricount show faces up front);
// we use initials + color since FlatSplit has no profile photos (yet).

const PALETTE = [
  { bg: '#2E5E4E', fg: '#F6F5F1' }, // pine
  { bg: '#B4552D', fg: '#FFF4EC' }, // clay
  { bg: '#3E5C76', fg: '#EFF4F9' }, // slate blue
  { bg: '#7A4E7E', fg: '#F9F0FA' }, // plum
  { bg: '#946B2D', fg: '#FBF4E8' }, // ochre
  { bg: '#2D6E6E', fg: '#ECF7F7' }, // teal
  { bg: '#8C3B4A', fg: '#FBEFF1' }, // maroon
  { bg: '#4E6E33', fg: '#F3F8ED' }, // moss
]

export function avatarColor(name) {
  const s = String(name || '?')
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

export function initialsOf(name) {
  const parts = String(name || '?').trim().split(/\s+/)
  const first = parts[0]?.[0] || '?'
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase()
}
