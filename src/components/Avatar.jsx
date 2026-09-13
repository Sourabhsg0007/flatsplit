import { avatarColor, initialsOf } from '../lib/avatar'

// Initials avatar with a stable per-person color.
export default function Avatar({ name, size = 34 }) {
  const { bg, fg } = avatarColor(name)
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, background: bg, color: fg, fontSize: size * 0.38 }}
      aria-hidden="true"
    >
      {initialsOf(name)}
    </span>
  )
}
