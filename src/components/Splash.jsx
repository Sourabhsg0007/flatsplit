// Branded app-start screen. Shown for a beat while the session loads,
// then the app fades in. Motion is disabled by prefers-reduced-motion.
export default function Splash() {
  return (
    <div className="splash-scene" role="status" aria-label="FlatSplit is starting">
      <div className="splash-inner">
        <span className="splash-mark">÷</span>
        <span className="splash-name">FlatSplit</span>
        <span className="splash-tag">shared expenses, settled simply</span>
      </div>
      <span className="splash-watermark" aria-hidden="true">÷</span>
    </div>
  )
}
