export function LostVsFoundChart({ lostCount = 0, foundCount = 0 }) {
  const total = lostCount + foundCount
  const lostPct = total > 0 ? Math.round((lostCount / total) * 100) : 50
  const foundPct = total > 0 ? 100 - lostPct : 50

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--amber)' }} />
          <span>Lost Items: <strong>{lostCount}</strong> ({lostPct}%)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--cyan)' }} />
          <span>Found Items: <strong>{foundCount}</strong> ({foundPct}%)</span>
        </div>
      </div>

      {/* Stacked Progress Bar */}
      <div style={{
        height: '14px',
        borderRadius: '999px',
        background: 'var(--bg-elevated-2)',
        overflow: 'hidden',
        display: 'flex',
        border: '1px solid var(--border-hair)'
      }}>
        <div style={{
          width: `${lostPct}%`,
          background: 'var(--amber)',
          transition: 'width 0.5s ease'
        }} />
        <div style={{
          width: `${foundPct}%`,
          background: 'var(--cyan)',
          transition: 'width 0.5s ease'
        }} />
      </div>
    </div>
  )
}

export function CategoryDistributionChart({ categories = [] }) {
  if (!categories || categories.length === 0) {
    return <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No item category data yet.</p>
  }

  const maxCount = Math.max(...categories.map((c) => c.count), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {categories.map((item) => {
        const pct = Math.round((item.count / maxCount) * 100)
        return (
          <div key={item.category} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>{item.category}</span>
              <span style={{ fontWeight: '600' }}>{item.count} items</span>
            </div>
            <div style={{
              height: '8px',
              borderRadius: '999px',
              background: 'var(--bg-elevated-2)',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${pct}%`,
                height: '100%',
                background: 'var(--grad-signal)',
                borderRadius: '999px',
                transition: 'width 0.4s ease'
              }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function RecoveryRateGauge({ rate = 0, recoveredCount = 0, totalCount = 0 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
      <div style={{
        position: 'relative',
        width: '90px',
        height: '90px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
          <path
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="var(--bg-elevated-2)"
            strokeWidth="3.2"
          />
          <path
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="var(--cyan)"
            strokeWidth="3.2"
            strokeDasharray={`${rate}, 100`}
            style={{ transition: 'stroke-dasharray 0.6s ease' }}
          />
        </svg>
        <div style={{
          position: 'absolute',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
          <span style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-primary)' }}>{rate}%</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.85rem' }}>
        <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>Overall Recovery Rate</span>
        <span style={{ color: 'var(--text-muted)' }}>
          {recoveredCount} of {totalCount} lost items returned to verified owners.
        </span>
      </div>
    </div>
  )
}
