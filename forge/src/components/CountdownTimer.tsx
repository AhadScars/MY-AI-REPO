import { useEffect, useMemo, useState } from 'react'

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  return {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
  }
}

export function CountdownTimer({ until }: { until: Date }) {
  const target = useMemo(() => until.getTime(), [until])
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const t = parts(target - now)
  const cells = [
    ['Days', t.d],
    ['Hrs', t.h],
    ['Min', t.m],
    ['Sec', t.s],
  ] as const

  return (
    <div className="timer" role="timer" aria-live="polite">
      {cells.map(([label, n]) => (
        <div key={label}>
          <b>{String(n).padStart(2, '0')}</b>
          <span>{label}</span>
        </div>
      ))}
    </div>
  )
}
