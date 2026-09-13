// Interactive donut chart — pure SVG, no chart library.
// data: [{ label, value }], selected: label | null, onSelect(label | null)
const PALETTE = [
  'var(--pine)', '#5B8C6E', '#C2803D', '#7A6FA0',
  '#B65C5C', '#4E8098', '#8C7A4E', '#A0526D',
]

// SVG text has no CSS ellipsis — bound the center strings in JS instead.
function truncateLabel(label) {
  const t = String(label || '')
  return t.length > 16 ? `${t.slice(0, 15)}\u2026` : t
}

export default function DonutChart({ data, selected, onSelect, formatValue }) {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  if (total <= 0) return null

  const cx = 90
  const cy = 90
  const r = 68
  const stroke = 26
  const circumference = 2 * Math.PI * r

  const segments = data.reduce((acc, d, i) => {
    const fraction = d.value / total
    const prev = acc.length ? acc[acc.length - 1] : null
    acc.push({
      ...d,
      color: PALETTE[i % PALETTE.length],
      dash: fraction * circumference,
      offset: prev ? prev.offset + prev.dash : 0,
      fraction,
    })
    return acc
  }, [])

  const active = selected ? segments.find((s) => s.label === selected) : null

  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 180 180" className="donut-svg" role="img" aria-label="Spending by category">
        {segments.map((s) => (
          <circle
            key={s.label}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={selected === s.label ? stroke + 6 : stroke}
            strokeDasharray={`${Math.max(s.dash - 2, 0.5)} ${circumference - Math.max(s.dash - 2, 0.5)}`}
            strokeDashoffset={-s.offset}
            transform={`rotate(-90 ${cx} ${cy})`}
            className={`donut-seg ${selected && selected !== s.label ? 'dim' : ''}`}
            onClick={() => onSelect(selected === s.label ? null : s.label)}
            style={{ cursor: 'pointer' }}
          >
            <title>{`${s.label}: ${formatValue(s.value)} (${Math.round(s.fraction * 100)}%)`}</title>
          </circle>
        ))}
        <text x={cx} y={cy - 6} textAnchor="middle" className="donut-center-label">
          {truncateLabel(active ? active.label : 'Total')}
        </text>
        <text
          x={cx}
          y={cy + 14}
          textAnchor="middle"
          className={`donut-center-value ${formatValue(active ? active.value : total).length > 10 ? 'donut-center-value-sm' : ''}`}
        >
          {formatValue(active ? active.value : total)}
        </text>
      </svg>

      <ul className="donut-legend">
        {segments.map((s) => (
          <li key={s.label}>
            <button
              type="button"
              className={`donut-legend-item ${selected === s.label ? 'active' : ''}`}
              onClick={() => onSelect(selected === s.label ? null : s.label)}
            >
              <span className="donut-dot" style={{ background: s.color }} />
              <span className="donut-legend-label">{s.label}</span>
              <span className="donut-legend-pct">{Math.round(s.fraction * 100)}%</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
