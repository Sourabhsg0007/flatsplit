import { categoryMeta } from '../lib/categoryMeta'

// Small tinted icon circle for an expense category.
export default function CategoryChip({ category, size = 34 }) {
  const { Icon, tint } = categoryMeta(category)
  return (
    <span
      className="cat-chip"
      style={{ width: size, height: size, color: tint, background: `color-mix(in srgb, ${tint} 14%, transparent)` }}
      aria-hidden="true"
    >
      <Icon size={size * 0.52} strokeWidth={2.2} />
    </span>
  )
}
